import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { TOKEN_KEY, REFRESH_KEY } from '../auth/spotifyAuth';
import { SELECTED_PLAYLISTS_KEY } from './PlaylistPickerScreen';
import { getRandomTrack, playTrack } from '../spotify/spotifyApi';

interface Props {
  onPickPlaylists: () => void;
  onLogout: () => void;
}

export default function HomeScreen({ onPickPlaylists, onLogout }: Props) {
  const [selectedCount, setSelectedCount] = useState(0);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadSelectedCount();
  }, []);

  async function loadSelectedCount() {
    const stored = await SecureStore.getItemAsync(SELECTED_PLAYLISTS_KEY);
    if (stored) setSelectedCount((JSON.parse(stored) as string[]).length);
  }

  async function handleTestPlay() {
    const stored = await SecureStore.getItemAsync(SELECTED_PLAYLISTS_KEY);
    const ids: string[] = stored ? JSON.parse(stored) : [];
    if (ids.length === 0) {
      Alert.alert('No playlists selected', 'Tap "Change Playlists" to pick some first.');
      return;
    }

    setTesting(true);
    try {
      const track = await getRandomTrack(ids);
      if (!track) {
        Alert.alert('No tracks found', 'Your selected playlists appear to be empty.');
        return;
      }

      const result = await playTrack(track.uri);

      if (result === 'success') {
        Alert.alert(
          'Now Playing',
          `${track.name} — ${track.artists.map((a) => a.name).join(', ')}`,
        );
      } else if (result === 'no_device') {
        Alert.alert(
          'Spotify not active',
          'Open the Spotify app first, then try again.',
          [
            { text: 'Open Spotify', onPress: () => Linking.openURL('spotify://') },
            { text: 'Cancel', style: 'cancel' },
          ],
        );
      } else if (result === 'not_premium') {
        Alert.alert(
          'Spotify Premium required',
          'Remote playback control requires a Spotify Premium account.',
        );
      } else {
        Alert.alert('Playback error', 'Something went wrong. Try again.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Something went wrong.');
    } finally {
      setTesting(false);
    }
  }

  async function handleLogout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    onLogout();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Spotify Alarm</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Alarm playlists</Text>
        <Text style={styles.cardValue}>
          {selectedCount === 0 ? 'None selected' : `${selectedCount} playlist${selectedCount === 1 ? '' : 's'}`}
        </Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={onPickPlaylists}>
        <Text style={styles.buttonText}>Change Playlists</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonOutline, testing && styles.buttonDisabled]}
        onPress={handleTestPlay}
        disabled={testing}
      >
        <Text style={styles.buttonOutlineText}>{testing ? 'Picking a track…' : 'Test Alarm Play'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#191414', justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#1DB954', marginBottom: 40 },
  card: {
    width: '100%',
    backgroundColor: '#282828',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  cardLabel: { color: '#aaa', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  cardValue: { color: '#fff', fontSize: 20, fontWeight: '600' },
  button: {
    width: '100%',
    backgroundColor: '#1DB954',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#1DB954' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  buttonOutlineText: { color: '#1DB954', fontWeight: 'bold', fontSize: 16 },
  logoutButton: { marginTop: 24 },
  logoutText: { color: '#aaa', fontSize: 14 },
});
