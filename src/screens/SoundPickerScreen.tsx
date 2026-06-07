import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { AlarmSound, Alarm } from '../alarm/alarmStore';
import { fetchTopTracks, getTrackPreviewUrl, SpotifyTrackWithImage } from '../spotify/spotifyApi';
import { getStoredAccessToken, useSpotifyAuth } from '../auth/spotifyAuth';

interface Props {
  alarm: Alarm;
  onDone: (sound: AlarmSound) => void;
  onPickSong: () => void;
  onBack: () => void;
}

export default function SoundPickerScreen({ alarm, onDone, onPickSong, onBack }: Props) {
  const [linked, setLinked] = useState(false);
  const [topTracks, setTopTracks] = useState<SpotifyTrackWithImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [tracksError, setTracksError] = useState(false);
  const { request, response, promptAsync, exchangeToken, logout } = useSpotifyAuth();

  useEffect(() => {
    checkLinkedAndLoad();
  }, []);

  // Handle OAuth response (when user connects Spotify from this screen)
  useEffect(() => {
    if (response) console.log('[SoundPicker] OAuth response type:', response.type);
    if (response?.type === 'success') {
      const { code } = response.params;
      const codeVerifier = request?.codeVerifier;
      if (code && codeVerifier) {
        exchangeToken(code, codeVerifier)
          .then(() => checkLinkedAndLoad())
          .catch((e: unknown) => {
            const msg = e instanceof Error ? e.message : String(e);
            console.log('[SoundPicker] exchangeToken error:', msg);
            Alert.alert('Spotify Error', msg);
          });
      }
    }
  }, [response]);

  async function checkLinkedAndLoad() {
    setLoading(true);
    setTracksError(false);
    const token = await getStoredAccessToken();
    console.log('[SoundPicker] checkLinkedAndLoad — token present:', !!token);
    if (!token) {
      setLinked(false);
      setLoading(false);
      return;
    }
    setLinked(true);
    try {
      const tracks = await fetchTopTracks(5);
      console.log('[SoundPicker] top tracks count:', tracks.length);
      setTopTracks(tracks);
    } catch (e) {
      console.log('[SoundPicker] fetchTopTracks error:', e instanceof Error ? e.message : String(e));
      setTracksError(true);
    } finally {
      setLoading(false);
    }
  }

  const currentUri = alarm.sound.type === 'spotify_track' ? alarm.sound.trackUri : undefined;
  const isSurprise = alarm.sound.type === 'spotify_surprise';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backBtn}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sound</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#FF9500" />
        </View>
      ) : !linked ? (
        // ── Unlinked: show service options ──────────────────────────────────
        <View style={styles.unlinkedContainer}>
          <Text style={styles.connectHeading}>Connect to Spotify, YouTube, or use your own audio</Text>
          <TouchableOpacity
            style={styles.serviceRow}
            disabled={!request}
            onPress={() => promptAsync()}
          >
            <Text style={[styles.serviceLabel, !request && styles.disabledLabel]}>
              Spotify
            </Text>
            {request ? (
              <Text style={styles.chevron}>›</Text>
            ) : (
              <ActivityIndicator size="small" color="#555" />
            )}
          </TouchableOpacity>
          <View style={[styles.serviceRow, styles.serviceRowDisabled]}>
            <Text style={[styles.serviceLabel, styles.disabledLabel]}>YouTube</Text>
            <Text style={styles.comingSoon}>Coming soon</Text>
          </View>
          <View style={[styles.serviceRow, styles.serviceRowDisabled]}>
            <Text style={[styles.serviceLabel, styles.disabledLabel]}>Local Files</Text>
            <Text style={styles.comingSoon}>Coming soon</Text>
          </View>
          <View style={[styles.serviceRow, styles.serviceRowDisabled]}>
            <Text style={[styles.serviceLabel, styles.disabledLabel]}>Upload Audio</Text>
            <Text style={styles.comingSoon}>Coming soon</Text>
          </View>
        </View>
      ) : (
        // ── Linked: show track list ──────────────────────────────────────────
        <FlatList
          data={[
            { kind: 'none' as const },
            { kind: 'spotifyHeader' as const },
            ...(tracksError
              ? [{ kind: 'tracksError' as const }]
              : topTracks.map((t) => ({ kind: 'track' as const, track: t }))),
            ...(topTracks.length === 0 && !tracksError
              ? [{ kind: 'noTracks' as const }]
              : []),
            { kind: 'pick' as const },
            { kind: 'surprise' as const },
            { kind: 'otherHeader' as const },
            { kind: 'youtube' as const },
            { kind: 'reconnect' as const },
            { kind: 'footer' as const },
          ]}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => {
            if (item.kind === 'spotifyHeader') {
              return <Text style={styles.sectionHeader}>Spotify</Text>;
            }
            if (item.kind === 'otherHeader') {
              return <Text style={styles.sectionHeader}>Other</Text>;
            }
            if (item.kind === 'footer') {
              return <View style={{ height: 40 }} />;
            }
            if (item.kind === 'none') {
              return (
                <TouchableOpacity style={styles.row} onPress={() => onDone({ type: 'none' })}>
                  <Text style={styles.rowLabel}>None</Text>
                  {alarm.sound.type === 'none' && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              );
            }
            if (item.kind === 'tracksError') {
              return (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>
                    Couldn't reach Spotify. Tap "Reconnect Spotify" below to re-link.
                  </Text>
                </View>
              );
            }
            if (item.kind === 'noTracks') {
              return (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>No top tracks yet — use "Pick another song" below.</Text>
                </View>
              );
            }
            if (item.kind === 'track') {
              const t = item.track;
              const isSelected = currentUri === t.uri;
              return (
                <TouchableOpacity
                  style={styles.trackRow}
                  onPress={async () => {
                    const trackId = t.uri.split(':').pop()!;
                    let previewUrl = t.previewUrl;
                    if (!previewUrl) {
                      previewUrl = await getTrackPreviewUrl(trackId, t.name, t.artists) ?? undefined;
                    }
                    onDone({
                      type: 'spotify_track',
                      trackUri: t.uri,
                      trackName: t.name,
                      trackArtist: t.artists[0]?.name,
                      previewUrl,
                    });
                  }}
                >
                  {t.albumImageUrl ? (
                    <Image source={{ uri: t.albumImageUrl }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]} />
                  )}
                  <View style={styles.trackText}>
                    <Text style={styles.trackName} numberOfLines={1}>{t.name}</Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>
                      {t.artists.map((a) => a.name).join(', ')}
                    </Text>
                  </View>
                  {isSelected && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              );
            }
            if (item.kind === 'pick') {
              return (
                <TouchableOpacity style={styles.row} onPress={onPickSong}>
                  <Text style={styles.rowLabel}>Pick another song</Text>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              );
            }
            if (item.kind === 'surprise') {
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => onDone({ type: 'spotify_surprise' })}
                >
                  <Text style={styles.rowLabel}>Surprise me</Text>
                  {isSurprise && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              );
            }
            if (item.kind === 'youtube') {
              return (
                <View style={[styles.row, styles.rowDisabled]}>
                  <Text style={[styles.rowLabel, styles.disabledLabel]}>YouTube</Text>
                  <Text style={styles.comingSoon}>Coming soon</Text>
                </View>
              );
            }
            if (item.kind === 'reconnect') {
              return (
                <TouchableOpacity
                  style={styles.row}
                  disabled={!request}
                  onPress={async () => {
                    await logout();
                    promptAsync();
                  }}
                >
                  <Text style={styles.reconnectLabel}>
                    {request ? 'Reconnect Spotify' : 'Reconnect Spotify (loading…)'}
                  </Text>
                </TouchableOpacity>
              );
            }
            return null;
          }}
        />
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  sectionHeader: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  rowLabel: { color: '#fff', fontSize: 16 },
  rowDisabled: { opacity: 0.4 },
  reconnectLabel: { color: '#888', fontSize: 14 },
  check: { color: '#FF9500', fontSize: 18 },
  chevron: { color: '#555', fontSize: 20 },
  infoRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  infoText: { color: '#888', fontSize: 14 },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  thumb: { width: 44, height: 44, borderRadius: 4, marginRight: 12 },
  thumbPlaceholder: { backgroundColor: '#333' },
  trackText: { flex: 1 },
  trackName: { color: '#fff', fontSize: 15, fontWeight: '500' },
  trackArtist: { color: '#888', fontSize: 13, marginTop: 2 },
  unlinkedContainer: { flex: 1, padding: 24 },
  connectHeading: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 24 },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  serviceRowDisabled: { opacity: 0.4 },
  serviceLabel: { color: '#fff', fontSize: 16 },
  disabledLabel: { color: '#888' },
  comingSoon: { color: '#555', fontSize: 13 },
});
