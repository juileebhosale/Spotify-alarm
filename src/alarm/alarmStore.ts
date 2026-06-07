import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AlarmSound {
  type: 'spotify_track' | 'spotify_surprise' | 'none';
  trackUri?: string;
  trackName?: string;
  trackArtist?: string;
  previewUrl?: string;             // Spotify 30s preview MP3 URL
  localPreviewUri?: string;        // file:// URI for expo-av playback when app is alive
  notificationSoundFile?: string;  // filename in Library/Sounds/ (e.g. 'ap_abc123.mp3') — iOS plays this when app is killed
}

export interface Alarm {
  id: string;
  hour: number;       // 0–23
  minute: number;     // 0–59
  repeat: 'never' | 'daily' | 'weekdays' | 'weekends' | 'custom' | 'monthly';
  repeatDays: number[]; // 0=Sun … 6=Sat, used when repeat === 'custom'
  label: string;
  sound: AlarmSound;
  snooze: boolean;
  enabled: boolean;
  notificationIds: string[]; // one or more expo-notifications IDs
}

const STORAGE_KEY = 'alarms_v1';

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function makeDefaultAlarm(): Alarm {
  const now = new Date();
  return {
    id: makeId(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    repeat: 'never',
    repeatDays: [],
    label: '',
    sound: { type: 'none' },
    snooze: true,
    enabled: true,
    notificationIds: [],
  };
}

export async function loadAlarms(): Promise<Alarm[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as Alarm[];
}

export async function saveAlarms(alarms: Alarm[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
}

export async function upsertAlarm(alarm: Alarm): Promise<Alarm[]> {
  const alarms = await loadAlarms();
  const idx = alarms.findIndex((a) => a.id === alarm.id);
  if (idx >= 0) {
    alarms[idx] = alarm;
  } else {
    alarms.push(alarm);
  }
  await saveAlarms(alarms);
  return alarms;
}

export async function deleteAlarm(id: string): Promise<Alarm[]> {
  const alarms = (await loadAlarms()).filter((a) => a.id !== id);
  await saveAlarms(alarms);
  return alarms;
}

export async function toggleAlarm(id: string, enabled: boolean): Promise<Alarm[]> {
  const alarms = await loadAlarms();
  const alarm = alarms.find((a) => a.id === id);
  if (alarm) alarm.enabled = enabled;
  await saveAlarms(alarms);
  return alarms;
}

// Human-readable repeat description shown as alarm subtitle.
export function repeatLabel(alarm: Alarm): string {
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  switch (alarm.repeat) {
    case 'never':    return alarm.label || 'Alarm';
    case 'daily':    return 'Every day';
    case 'weekdays': return 'Every weekday';
    case 'weekends': return 'Every weekend';
    case 'monthly':  return 'Every month';
    case 'custom':
      if (alarm.repeatDays.length === 0) return alarm.label || 'Alarm';
      return alarm.repeatDays
        .slice()
        .sort((a, b) => a - b)
        .map((d) => DAY_NAMES[d])
        .join(', ');
  }
}

export function formatTime(hour: number, minute: number): string {
  const ampm = hour < 12 ? 'AM' : 'PM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${ampm}`;
}
