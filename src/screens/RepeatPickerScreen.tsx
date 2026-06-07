import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Alarm } from '../alarm/alarmStore';

const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_FULL  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type RepeatOption = Alarm['repeat'];

const OPTIONS: { value: RepeatOption; label: string }[] = [
  { value: 'never',    label: 'Never' },
  { value: 'daily',    label: 'Every Day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'custom',   label: 'Custom' },
  { value: 'monthly',  label: 'Every Month' },
];

interface Props {
  alarm: Alarm;
  onDone: (repeat: RepeatOption, days: number[]) => void;
  onBack: () => void;
}

export default function RepeatPickerScreen({ alarm, onDone, onBack }: Props) {
  const [selected, setSelected] = useState<RepeatOption>(alarm.repeat);
  const [customDays, setCustomDays] = useState<Set<number>>(new Set(alarm.repeatDays));

  function toggleDay(d: number) {
    setCustomDays((prev) => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });
  }

  function handleSelect(value: RepeatOption) {
    setSelected(value);
    if (value !== 'custom') {
      onDone(value, []);
    }
  }

  function handleCustomSave() {
    onDone('custom', [...customDays]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backBtn}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Repeat</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.card}>
        {OPTIONS.map((opt, i) => (
          <View key={opt.value}>
            <TouchableOpacity style={styles.row} onPress={() => handleSelect(opt.value)}>
              <Text style={styles.rowLabel}>{opt.label}</Text>
              {selected === opt.value && <Text style={styles.check}>✓</Text>}
            </TouchableOpacity>
            {i < OPTIONS.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>

      {selected === 'custom' && (
        <>
          <View style={styles.dayRow}>
            {DAY_NAMES.map((name, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.dayChip, customDays.has(i) && styles.dayChipSelected]}
                onPress={() => toggleDay(i)}
              >
                <Text style={[styles.dayChipText, customDays.has(i) && styles.dayChipTextSelected]}>
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.dayFullText}>
            {customDays.size === 0
              ? 'Select days'
              : [...customDays].sort((a, b) => a - b).map((d) => DAY_FULL[d]).join(', ')}
          </Text>
          <TouchableOpacity style={styles.saveBtn} onPress={handleCustomSave}>
            <Text style={styles.saveBtnText}>Done</Text>
          </TouchableOpacity>
        </>
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
  check: { color: '#FF9500', fontSize: 18 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#333', marginLeft: 16 },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 24,
  },
  dayChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayChipSelected: { backgroundColor: '#FF9500' },
  dayChipText: { color: '#888', fontSize: 14, fontWeight: '600' },
  dayChipTextSelected: { color: '#000' },
  dayFullText: { color: '#888', fontSize: 13, textAlign: 'center', marginTop: 10 },
  saveBtn: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: '#FF9500',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#000', fontWeight: '600', fontSize: 16 },
});
