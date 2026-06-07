import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Image,
  AppState,
  AppStateStatus,
} from 'react-native';
import { AlarmSound } from '../alarm/alarmStore';
import { fetchCurrentlyPlaying, getTrackPreviewUrl, SpotifyTrackWithImage } from '../spotify/spotifyApi';
import { cachePreview } from '../audio/previewCache';

interface Props {
  onDone: (sound: AlarmSound) => void;
  onBack: () => void;
}

export default function SpotifySongSearchScreen({ onDone, onBack }: Props) {
  const [track, setTrack] = useState<SpotifyTrackWithImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChecked, setHasChecked] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  // Auto-check when user returns to the app from Spotify
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        checkNowPlaying();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  async function checkNowPlaying() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCurrentlyPlaying();
      setTrack(result);
      setHasChecked(true);
      if (!result) setError('Nothing playing in Spotify. Play a song there and come back.');
    } catch (e) {
      setError('Could not reach Spotify. Make sure you\'re connected.');
      setHasChecked(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect() {
    if (!track) return;
    setConfirming(true);
    // Capture track now — state may change while we await.
    const selectedTrack = track;
    try {
      const trackId = selectedTrack.uri.split(':').pop()!;
      let previewUrl = selectedTrack.previewUrl;
      if (!previewUrl) {
        previewUrl = await getTrackPreviewUrl(trackId, selectedTrack.name, selectedTrack.artists) ?? undefined;
      }
      let localPreviewUri: string | undefined;
      if (previewUrl) {
        try {
          localPreviewUri = (await cachePreview(selectedTrack.uri, previewUrl)) ?? undefined;
        } catch {
          // Cache failed — alarm will stream the preview URL at fire time instead.
        }
      }
      onDone({
        type: 'spotify_track',
        trackUri: selectedTrack.uri,
        trackName: selectedTrack.name,
        trackArtist: selectedTrack.artists[0]?.name,
        previewUrl,
        localPreviewUri,
      });
    } catch {
      // Preview URL fetch failed — save the track without audio; alarm will use WAV fallback.
      onDone({
        type: 'spotify_track',
        trackUri: selectedTrack.uri,
        trackName: selectedTrack.name,
        trackArtist: selectedTrack.artists[0]?.name,
      });
    } finally {
      setConfirming(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backBtn}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pick a Song</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.step}>
          1. Open Spotify and play the song you want as your alarm.
        </Text>
        <Text style={styles.step}>
          2. Come back here — we'll pick it up automatically.
        </Text>

        <TouchableOpacity
          style={styles.openSpotifyBtn}
          onPress={() => Linking.openURL('spotify://')}
        >
          <Text style={styles.openSpotifyText}>Open Spotify</Text>
        </TouchableOpacity>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color="#FF9500" size="large" />
            <Text style={styles.loadingText}>Checking what's playing…</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={checkNowPlaying}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && track && (
          <View style={styles.trackCard}>
            {track.albumImageUrl ? (
              <Image source={{ uri: track.albumImageUrl }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]} />
            )}
            <View style={styles.trackText}>
              <Text style={styles.nowPlayingLabel}>Now playing</Text>
              <Text style={styles.trackName} numberOfLines={1}>{track.name}</Text>
              <Text style={styles.trackArtist} numberOfLines={1}>
                {track.artists.map((a) => a.name).join(', ')}
              </Text>
            </View>
          </View>
        )}

        {!loading && hasChecked && (
          <TouchableOpacity style={styles.checkBtn} onPress={checkNowPlaying}>
            <Text style={styles.checkBtnText}>
              {track ? 'Playing something else? Refresh' : 'Check again'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {track && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.useBtn} onPress={handleSelect} disabled={confirming}>
            {confirming
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.useBtnText}>Use This Song</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  backBtn: { color: '#FF9500', fontSize: 17 },
  body: { flex: 1, padding: 24 },
  step: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  openSpotifyBtn: {
    backgroundColor: '#1DB954',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  openSpotifyText: { color: '#000', fontSize: 15, fontWeight: '700' },
  center: { alignItems: 'center', paddingVertical: 20, gap: 12 },
  loadingText: { color: '#888', fontSize: 14 },
  errorBox: { alignItems: 'center', gap: 12 },
  errorText: { color: '#FF3B30', fontSize: 14, textAlign: 'center' },
  retryBtn: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  retryText: { color: '#fff', fontSize: 14 },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  thumb: { width: 56, height: 56, borderRadius: 4, marginRight: 14 },
  thumbPlaceholder: { backgroundColor: '#333' },
  trackText: { flex: 1 },
  nowPlayingLabel: { color: '#1DB954', fontSize: 11, fontWeight: '600', marginBottom: 3 },
  trackName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  trackArtist: { color: '#888', fontSize: 13, marginTop: 3 },
  checkBtn: { alignSelf: 'center' },
  checkBtnText: { color: '#FF9500', fontSize: 14 },
  footer: { padding: 20, paddingBottom: 40 },
  useBtn: {
    backgroundColor: '#FF9500',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  useBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
});
