import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { fetchPlaylists, SpotifyPlaylist } from '../spotify/spotifyApi';

export const SELECTED_PLAYLISTS_KEY = 'selected_playlist_ids';

interface Props {
  onDone: () => void;
}

export default function PlaylistPickerScreen({ onDone }: Props) {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [lists, stored] = await Promise.all([
          fetchPlaylists(),
          SecureStore.getItemAsync(SELECTED_PLAYLISTS_KEY),
        ]);
        setPlaylists(lists);
        if (stored) {
          setSelected(new Set(JSON.parse(stored) as string[]));
        }
      } catch (e: any) {
        Alert.alert('Error', e.message ?? 'Could not load playlists.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function save() {
    if (selected.size === 0) {
      Alert.alert('Select at least one playlist', 'Pick one or more playlists to use as alarm music.');
      return;
    }
    setSaving(true);
    await SecureStore.setItemAsync(SELECTED_PLAYLISTS_KEY, JSON.stringify([...selected]));
    setSaving(false);
    onDone();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1DB954" size="large" />
        <Text style={styles.loadingText}>Loading your playlists…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pick Alarm Playlists</Text>
      <Text style={styles.subtitle}>
        {selected.size === 0
          ? 'Select playlists to use as alarm music'
          : `${selected.size} playlist${selected.size === 1 ? '' : 's'} selected`}
      </Text>

      <FlatList
        data={playlists}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.row, isSelected && styles.rowSelected]}
              onPress={() => toggle(item.id)}
            >
              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.rowText}>
                <Text style={styles.playlistName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.trackCount}>{item.tracks.total} tracks</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.list}
      />

      <TouchableOpacity
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={save}
        disabled={saving}
      >
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save & Continue'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#191414', paddingTop: 60 },
  center: { flex: 1, backgroundColor: '#191414', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 12 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1DB954', paddingHorizontal: 20, marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#aaa', paddingHorizontal: 20, marginBottom: 16 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  rowSelected: { backgroundColor: '#1a2e1a' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#555',
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: { backgroundColor: '#1DB954', borderColor: '#1DB954' },
  checkmark: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  rowText: { flex: 1 },
  playlistName: { color: '#fff', fontSize: 15, fontWeight: '500' },
  trackCount: { color: '#aaa', fontSize: 12, marginTop: 2 },
  button: {
    margin: 20,
    backgroundColor: '#1DB954',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});
