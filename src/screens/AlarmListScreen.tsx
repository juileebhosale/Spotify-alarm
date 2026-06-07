import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Switch,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { useFocusEffect } from '../hooks/useFocusEffect';
import { Alarm, loadAlarms, toggleAlarm, deleteAlarm, formatTime, repeatLabel } from '../alarm/alarmStore';
import { cancelAlarmNotifications, scheduleAlarm } from '../alarm/alarmScheduler';

interface Props {
  onAdd: () => void;
  onEdit: (alarm: Alarm) => void;
}

export default function AlarmListScreen({ onAdd, onEdit }: Props) {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [editMode, setEditMode] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadAlarms().then(setAlarms);
    }, []),
  );

  async function handleToggle(id: string, value: boolean) {
    const updated = await toggleAlarm(id, value);
    setAlarms(updated);
    const alarm = updated.find((a) => a.id === id);
    if (!alarm) return;
    if (value) {
      const ids = await scheduleAlarm(alarm);
      // persist updated notification IDs
      const { upsertAlarm } = await import('../alarm/alarmStore');
      await upsertAlarm({ ...alarm, notificationIds: ids });
    } else {
      await cancelAlarmNotifications(alarm.notificationIds);
    }
  }

  async function handleDelete(id: string) {
    const alarm = alarms.find((a) => a.id === id);
    if (alarm) await cancelAlarmNotifications(alarm.notificationIds);
    const updated = await deleteAlarm(id);
    setAlarms(updated);
  }

  function confirmDelete(alarm: Alarm) {
    Alert.alert('Delete Alarm', `Delete alarm at ${formatTime(alarm.hour, alarm.minute)}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(alarm.id) },
    ]);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setEditMode((e) => !e)}>
          <Text style={styles.headerBtn}>{editMode ? 'Done' : 'Edit'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alarms</Text>
        <TouchableOpacity onPress={onAdd}>
          <Text style={styles.headerBtn}>+</Text>
        </TouchableOpacity>
      </View>

      {alarms.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No alarms.</Text>
          <Text style={styles.emptySubtext}>Tap + to add one.</Text>
        </View>
      ) : (
        <FlatList
          data={alarms}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {editMode && (
                <TouchableOpacity style={styles.deleteCircle} onPress={() => confirmDelete(item)}>
                  <Text style={styles.deleteCircleText}>−</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.rowContent} onPress={() => onEdit(item)}>
                <View>
                  <Text style={[styles.timeText, !item.enabled && styles.dimmed]}>
                    {formatTime(item.hour, item.minute)}
                  </Text>
                  <Text style={[styles.subtitleText, !item.enabled && styles.dimmed]}>
                    {item.label ? item.label : repeatLabel(item)}
                  </Text>
                </View>
              </TouchableOpacity>
              {!editMode && (
                <Switch
                  value={item.enabled}
                  onValueChange={(v) => handleToggle(item.id, v)}
                  trackColor={{ false: '#3a3a3a', true: '#FF9500' }}
                  thumbColor="#fff"
                />
              )}
            </View>
          )}
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
  headerBtn: { color: '#FF9500', fontSize: 17 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  emptySubtext: { color: '#888', fontSize: 14, marginTop: 6 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#333', marginLeft: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#000',
  },
  deleteCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  deleteCircleText: { color: '#fff', fontSize: 20, lineHeight: 22, fontWeight: '300' },
  rowContent: { flex: 1 },
  timeText: { color: '#fff', fontSize: 48, fontWeight: '200', letterSpacing: -1 },
  subtitleText: { color: '#888', fontSize: 14, marginTop: 2 },
  dimmed: { opacity: 0.4 },
});
