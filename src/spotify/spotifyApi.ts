import { getStoredAccessToken, refreshStoredToken } from '../auth/spotifyAuth';

export interface SpotifyPlaylist {
  id: string;
  name: string;
  images: { url: string }[];
  tracks: { total: number };
}

export interface SpotifyTrack {
  uri: string;
  name: string;
  artists: { name: string }[];
}

// Makes an authenticated Spotify API request, retrying once after token refresh on 401.
async function spotifyFetch(url: string, options?: RequestInit): Promise<Response> {
  let token = await getStoredAccessToken();
  console.log('[spotifyFetch] token present:', !!token, '| url:', url.split('?')[0]);
  let res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });
  console.log('[spotifyFetch] status:', res.status);
  if (!res.ok && res.status !== 401) {
    const body = await res.clone().text().catch(() => '');
    console.log('[spotifyFetch] error body:', body);
  }

  if (res.status === 401) {
    console.log('[spotifyFetch] 401 — attempting token refresh');
    token = await refreshStoredToken();
    if (!token) throw new Error('Session expired. Please log in again.');
    res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    });
    console.log('[spotifyFetch] retry status:', res.status);
  }

  return res;
}

export async function fetchPlaylists(): Promise<SpotifyPlaylist[]> {
  const playlists: SpotifyPlaylist[] = [];
  let url: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50';
  while (url) {
    const res = await spotifyFetch(url);
    if (!res.ok) throw new Error(`Failed to fetch playlists: ${res.status}`);
    const data = await res.json();
    playlists.push(...(data.items as SpotifyPlaylist[]));
    url = data.next as string | null;
  }
  return playlists;
}

async function fetchPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];
  let url: string | null =
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks` +
    `?limit=100&fields=next,items(track(uri,name,artists(name)))`;
  while (url) {
    const res = await spotifyFetch(url);
    if (!res.ok) throw new Error(`Failed to fetch tracks: ${res.status}`);
    const data = await res.json();
    // Skip null entries (local files, removed tracks)
    const valid = (data.items as any[]).filter((i) => i.track?.uri);
    tracks.push(...valid.map((i) => i.track as SpotifyTrack));
    url = data.next as string | null;
  }
  return tracks;
}

// Picks a random track from a random one of the given playlist IDs.
export async function getRandomTrack(playlistIds: string[]): Promise<SpotifyTrack | null> {
  if (playlistIds.length === 0) return null;
  const playlistId = playlistIds[Math.floor(Math.random() * playlistIds.length)];
  const tracks = await fetchPlaylistTracks(playlistId);
  if (tracks.length === 0) return null;
  return tracks[Math.floor(Math.random() * tracks.length)];
}

export interface SpotifyTrackWithImage extends SpotifyTrack {
  albumImageUrl?: string;
  previewUrl?: string;
}

function mapTrack(t: any): SpotifyTrackWithImage {
  return {
    uri: t.uri as string,
    name: t.name as string,
    artists: t.artists as { name: string }[],
    albumImageUrl: (t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url) as string | undefined,
    previewUrl: (t.preview_url as string | null) ?? undefined,
  };
}

export async function fetchTopTracks(limit = 5): Promise<SpotifyTrackWithImage[]> {
  const res = await spotifyFetch(
    `https://api.spotify.com/v1/me/top/tracks?limit=${limit}&time_range=medium_term`,
  );
  if (!res.ok) throw new Error(`Failed to fetch top tracks: ${res.status}`);
  const data = await res.json();
  return (data.items as any[]).map(mapTrack);
}

// Returns the track currently playing (or paused) in the user's Spotify client.
// Returns null if nothing is playing or the player is idle.
export async function fetchCurrentlyPlaying(): Promise<SpotifyTrackWithImage | null> {
  const res = await spotifyFetch('https://api.spotify.com/v1/me/player');
  if (res.status === 204 || res.status === 202) return null; // nothing playing
  if (!res.ok) throw new Error(`Failed to fetch player state: ${res.status}`);
  const data = await res.json();
  const t = data?.item;
  if (!t || data?.currently_playing_type !== 'track') return null;
  return mapTrack(t);
}

// Tries multiple approaches to get a 30s preview MP3 URL for a track.
// The main track endpoint now returns null for most tracks; these are workarounds.
export async function getTrackPreviewUrl(
  trackId: string,
  trackName: string,
  artists: { name: string }[],
): Promise<string | null> {
  // Approach 1: Search endpoint — sometimes still returns preview_url when track endpoint returns null
  try {
    const q = encodeURIComponent(`track:${trackName} artist:${artists[0]?.name ?? ''}`);
    const res = await spotifyFetch(
      `https://api.spotify.com/v1/search?q=${q}&type=track&limit=5`,
    );
    if (res.ok) {
      const data = await res.json();
      const items: any[] = data.tracks?.items ?? [];
      // Prefer exact ID match with preview
      const exact = items.find((t) => t.id === trackId && t.preview_url);
      if (exact?.preview_url) {
        console.log('[Preview] Found via search (exact)');
        return exact.preview_url as string;
      }
      // Any result for this song with a preview
      const similar = items.find((t) => t.preview_url);
      if (similar?.preview_url) {
        console.log('[Preview] Found via search (similar)');
        return similar.preview_url as string;
      }
    }
  } catch (e) {
    console.log('[Preview] Search approach failed:', e instanceof Error ? e.message : String(e));
  }

  // Approach 2: Scrape the Spotify embed page — still serves previews for many tracks
  try {
    const embedRes = await fetch(`https://open.spotify.com/embed/track/${trackId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' },
    });
    if (embedRes.ok) {
      const html = await embedRes.text();
      // Extract from __NEXT_DATA__ JSON blob
      const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
      if (nextData) {
        const json = JSON.parse(nextData[1]);
        const entity =
          json?.props?.pageProps?.state?.data?.entity ??
          json?.props?.pageProps?.track;
        const url = entity?.audioPreview?.url ?? entity?.preview_url;
        if (url) {
          console.log('[Preview] Found via embed __NEXT_DATA__');
          return url as string;
        }
      }
      // Fallback: regex scan the whole HTML for any preview URL pattern
      const mp3Match =
        html.match(/"audioPreview"\s*:\s*\{"url"\s*:\s*"(https:\/\/[^"]+)"/) ??
        html.match(/"preview_url"\s*:\s*"(https:\/\/p\.scdn\.co[^"]+)"/);
      if (mp3Match) {
        console.log('[Preview] Found via embed HTML regex');
        return mp3Match[1];
      }
    }
  } catch (e) {
    console.log('[Preview] Embed approach failed:', e instanceof Error ? e.message : String(e));
  }

  console.log('[Preview] No preview found for track:', trackId);
  return null;
}

export type PlayResult = 'success' | 'no_device' | 'not_premium' | 'error';

export async function playTrack(trackUri: string): Promise<PlayResult> {
  const res = await spotifyFetch('https://api.spotify.com/v1/me/player/play', {
    method: 'PUT',
    body: JSON.stringify({ uris: [trackUri] }),
  });
  if (res.status === 204) return 'success';
  if (res.status === 404) return 'no_device';
  if (res.status === 403) return 'not_premium';
  return 'error';
}
