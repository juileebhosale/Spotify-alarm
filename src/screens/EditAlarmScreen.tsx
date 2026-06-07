import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Alarm,
  makeDefaultAlarm,
  upsertAlarm,
  deleteAlarm,
  formatTime,
} from '../alarm/alarmStore';
import { scheduleAlarm, cancelAlarmNotifications } from '../alarm/alarmScheduler';

function repeatDisplay(repeat: Alarm['repeat'], repeatDays: number[]): string {
  const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  switch (repeat) {
    case 'never':    return 'Never';
    case 'daily':    return 'Every Day';
    case 'weekdays': return 'Weekdays';
    case 'weekends': return 'Weekends';
    case 'monthly':  return 'Every Month';
    case 'custom':
      return repeatDays.length === 0
        ? 'Custom'
        : repeatDays.slice().sort((a, b) => a - b).map((d) => DAY[d]).join(', ');
  }
}

function soundDisplay(sound: Alarm['sound']): string {
  switch (sound.type) {
    case 'none':             return 'None';
    case 'spotify_surprise': return 'Surprise me (Spotify)';
    case 'spotify_track':    return sound.trackName ?? 'Spotify track';
  }
}

interface Props {
  alarm?: Alarm;
  onSave: () => void;
  onCancel: () => void;
  // Called with the full current working alarm so nav can pass it to sub-screens
  onRepeat: (currentAlarm: Alarm) => void;
  onSound: (currentAlarm: Alarm) => void;
}

export default function EditAlarmScreen({ alarm: initial, onSave, onCancel, onRepeat, onSound }: Props) {
  const isNew = !initial;
  const base = initial ?? makeDefaultAlarm();

  const initDate = new Date();
  initDate.setHours(base.hour, base.minute, 0, 0);

  const [date, setDate] = useState(initDate);
  const [repeat, setRepeat] = useState<Alarm['repeat']>(base.repeat);
  const [repeatDays, setRepeatDays] = useState<number[]>(base.repeatDays);
  const [label, setLabel] = useState(base.label);
  const [sound, setSound] = useState<Alarm['sound']>(base.sound);
  const [snooze, setSnooze] = useState(base.snooze);

  // Returns the full working alarm assembled from current state
  function currentAlarm(): Alarm {
    return {
      ...base,
      hour: date.getHours(),
      minute: date.getMinutes(),
      repeat,
      repeatDays,
      label,
      sound,
      snooze,
      enabled: base.enabled,
    };
  }

  async function handleSave() {
    const updated: Alarm = { ...currentAlarm(), enabled: true };
    await cancelAlarmNotifications(updated.notificationIds);
    const ids = await scheduleAlarm({ ...updated, enabled: true });
    await upsertAlarm({ ...updated, notificationIds: ids });
    onSave();
  }

  async function handleDelete() {
    Alert.alert('Delete Alarm', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cancelAlarmNotifications(base.notificationIds);
          await deleteAlarm(base.id);
          onSave();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.headerBtn}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isNew ? 'Add Alarm' : 'Edit Alarm'}</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.headerBtn}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.pickerWrapper}>
          <DateTimePicker
            value={date}
            mode="time"
            display="spinner"
            textColor="#fff"
            onChange={(_e, d) => d && setDate(d)}
            style={styles.timePicker}
          />
        </View>

        <View style={styles.card}>
          <SettingsRow
            label="Repeat"
            value={repeatDisplay(repeat, repeatDays)}
            onPress={() => onRepeat(currentAlarm())}
          />
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Label</Text>
            <TextInput
              style={styles.labelInput}
              value={label}
              onChangeText={setLabel}
              placeholder="Alarm"
              placeholderTextColor="#555"
              returnKeyType="done"
            />
          </View>
          <View style={styles.divider} />

          <SettingsRow
            label="Sound"
            value={soundDisplay(sound)}
            onPress={() => onSound(currentAlarm())}
          />
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Snooze</Text>
            <Switch
              value={snooze}
              onValueChange={setSnooze}
              trackColor={{ false: '#3a3a3a', true: '#FF9500' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {!isNew && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>Delete Alarm</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function SettingsRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={styles.rowValue}>{value}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
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
  scroll: { paddingBottom: 40 },
  pickerWrapper: { alignItems: 'center', paddingVertical: 8 },
  timePicker: { width: '100%', height: 200 },
  card: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: { color: '#fff', fontSize: 16 },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { color: '#888', fontSize: 16, marginRight: 6 },
  chevron: { color: '#555', fontSize: 20 },
  labelInput: { color: '#fff', fontSize: 16, textAlign: 'right', flex: 1, marginLeft: 8 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#333', marginLeft: 16 },
  deleteBtn: {
    marginHorizontal: 20,
    marginTop: 32,
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  deleteBtnText: { color: '#FF3B30', fontSize: 16 },
});
