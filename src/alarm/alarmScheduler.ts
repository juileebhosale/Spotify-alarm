import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { Alarm, loadAlarms, upsertAlarm } from './alarmStore';
import { getRandomTrack, getTrackPreviewUrl } from '../spotify/spotifyApi';
import * as SecureStore from 'expo-secure-store';
import { SELECTED_PLAYLISTS_KEY } from '../screens/PlaylistPickerScreen';

// Bundled fallback alarm sound (used when no Spotify preview is available).
const FALLBACK_SOUND = require('../../assets/alarm.wav');

// Module-level reference so we can stop audio on dismiss/snooze.
let activeSound: Audio.Sound | null = null;

export async function stopAlarmAudio(): Promise<void> {
  if (activeSound) {
    try { await activeSound.stopAsync(); } catch {}
    try { await activeSound.unloadAsync(); } catch {}
    activeSound = null;
  }
}

async function playAlarmAudio(source: string | number): Promise<void> {
  await stopAlarmAudio();
  await Audio.setAudioModeAsync({
    staysActiveInBackground: true,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: false,
  });
  const { sound } = await Audio.Sound.createAsync(
    typeof source === 'string' ? { uri: source } : source,
    { shouldPlay: true, isLooping: true, volume: 1.0 },
  );
  activeSound = sound;
  console.log('[Alarm] Playing audio:', typeof source === 'string' ? source : 'bundled fallback');
}

// Show notifications even when app is foregrounded.
// Suppress the system alarm.wav when the alarm has a Spotify preview (app will play it instead).
// Fall back to system sound when there is no preview (app is killed or no preview URL stored).
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const alarmId = notification.request.content.data?.alarmId as string | undefined;
    let hasPreview = false;
    if (alarmId) {
      const alarms = await loadAlarms();
      const alarm = alarms.find((a) => a.id === alarmId);
      hasPreview = !!(
        alarm &&
        alarm.sound.type !== 'none' &&
        (alarm.sound.localPreviewUri || alarm.sound.previewUrl || alarm.sound.type === 'spotify_surprise')
      );
    }
    return {
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: !hasPreview,  // let the app play Spotify preview; WAV only as fallback
      shouldSetBadge: false,
    };
  },
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Schedule a single alarm ────────────────────────────────────────────────

export async function scheduleAlarm(alarm: Alarm): Promise<string[]> {
  await cancelAlarmNotifications(alarm.notificationIds);

  if (!alarm.enabled) return [];

  const ids: string[] = [];
  const now = new Date();

  if (alarm.repeat === 'never') {
    const trigger = nextOccurrenceOnce(alarm.hour, alarm.minute, now);
    if (trigger) {
      const id = await Notifications.scheduleNotificationAsync({
        content: buildContent(alarm),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
      });
      ids.push(id);
    }
  } else if (alarm.repeat === 'daily') {
    const id = await Notifications.scheduleNotificationAsync({
      content: buildContent(alarm),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: alarm.hour,
        minute: alarm.minute,
      },
    });
    ids.push(id);
  } else if (alarm.repeat === 'weekdays') {
    for (const day of [2, 3, 4, 5, 6]) { // Mon–Fri (expo uses 1=Sun)
      const id = await Notifications.scheduleNotificationAsync({
        content: buildContent(alarm),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day,
          hour: alarm.hour,
          minute: alarm.minute,
        },
      });
      ids.push(id);
    }
  } else if (alarm.repeat === 'weekends') {
    for (const day of [1, 7]) { // Sun, Sat
      const id = await Notifications.scheduleNotificationAsync({
        content: buildContent(alarm),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day,
          hour: alarm.hour,
          minute: alarm.minute,
        },
      });
      ids.push(id);
    }
  } else if (alarm.repeat === 'custom' && alarm.repeatDays.length > 0) {
    // repeatDays uses 0=Sun … 6=Sat; expo-notifications weekday uses 1=Sun … 7=Sat
    for (const day of alarm.repeatDays) {
      const id = await Notifications.scheduleNotificationAsync({
        content: buildContent(alarm),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day + 1,
          hour: alarm.hour,
          minute: alarm.minute,
        },
      });
      ids.push(id);
    }
  } else if (alarm.repeat === 'monthly') {
    // Schedule next 12 monthly occurrences (expo has no monthly trigger)
    let base = new Date(now);
    base.setHours(alarm.hour, alarm.minute, 0, 0);
    if (base <= now) base.setMonth(base.getMonth() + 1);
    for (let i = 0; i < 12; i++) {
      const trigger = new Date(base);
      trigger.setMonth(trigger.getMonth() + i);
      const id = await Notifications.scheduleNotificationAsync({
        content: buildContent(alarm),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
      });
      ids.push(id);
    }
  }

  return ids;
}

export async function cancelAlarmNotifications(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

export async function rescheduleAll(): Promise<void> {
  const alarms = await loadAlarms();
  for (const alarm of alarms) {
    const ids = await scheduleAlarm(alarm);
    await upsertAlarm({ ...alarm, notificationIds: ids });
  }
}

export async function scheduleSnooze(alarm: Alarm): Promise<void> {
  const snoozeDate = new Date(Date.now() + 9 * 60 * 1000);
  await Notifications.scheduleNotificationAsync({
    content: { ...buildContent(alarm), title: `Snoozed: ${buildContent(alarm).title}` },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: snoozeDate },
  });
}

// ─── Notification response handler (called from App.tsx) ────────────────────

export async function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): Promise<void> {
  const alarmId = response.notification.request.content.data?.alarmId as string | undefined;
  if (!alarmId) return;

  const alarms = await loadAlarms();
  const alarm = alarms.find((a) => a.id === alarmId);
  if (!alarm) return;

  if (response.actionIdentifier === 'snooze' && alarm.snooze) {
    await scheduleSnooze(alarm);
    return;
  }

  await triggerAlarmPlayback(alarm);
}

export async function triggerAlarmPlayback(alarm: Alarm): Promise<void> {
  if (alarm.sound.type === 'none') return;

  // spotify_track: play cached local file, or stream the preview URL directly.
  if (alarm.sound.type === 'spotify_track') {
    const audioSource = alarm.sound.localPreviewUri ?? alarm.sound.previewUrl;
    if (audioSource) {
      try {
        await playAlarmAudio(audioSource);
        console.log('[Alarm] Playing Spotify preview:', audioSource);
        return;
      } catch (e) {
        console.log('[Alarm] Preview playback failed:', e instanceof Error ? e.message : String(e));
      }
    }
  }

  // spotify_surprise: pick a random track and stream its preview URL.
  if (alarm.sound.type === 'spotify_surprise') {
    try {
      const stored = await SecureStore.getItemAsync(SELECTED_PLAYLISTS_KEY);
      const ids: string[] = stored ? JSON.parse(stored) : [];
      const track = await getRandomTrack(ids);
      if (track) {
        const trackId = track.uri.split(':').pop()!;
        const previewUrl = await getTrackPreviewUrl(trackId, track.name, track.artists);
        if (previewUrl) {
          await playAlarmAudio(previewUrl);
          console.log('[Alarm] Playing surprise preview:', track.name);
          return;
        }
      }
    } catch (e) {
      console.log('[Alarm] Surprise preview failed:', e instanceof Error ? e.message : String(e));
    }
  }

  // Fallback: bundled alarm sound.
  try {
    console.log('[Alarm] Playing bundled fallback sound.');
    await playAlarmAudio(FALLBACK_SOUND);
  } catch (e) {
    console.log('[Alarm] Fallback sound failed:', e instanceof Error ? e.message : String(e));
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildContent(alarm: Alarm): Notifications.NotificationContentInput {
  const label = alarm.label || 'Alarm';
  const soundDesc =
    alarm.sound.type === 'spotify_track'
      ? alarm.sound.trackName ?? 'Spotify'
      : alarm.sound.type === 'spotify_surprise'
      ? 'Surprise track'
      : '';
  return {
    title: label,
    body: soundDesc ? `Tap to play: ${soundDesc}` : 'Time to wake up!',
    data: { alarmId: alarm.id },
    categoryIdentifier: alarm.snooze ? 'alarm_snooze' : 'alarm',
    sound: 'alarm.wav',
  };
}

function nextOccurrenceOnce(hour: number, minute: number, after: Date): Date | null {
  const d = new Date(after);
  d.setHours(hour, minute, 0, 0);
  if (d <= after) d.setDate(d.getDate() + 1);
  return d;
}
