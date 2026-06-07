import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useSpotifyAuth } from './src/auth/spotifyAuth';
import { Alarm, AlarmSound } from './src/alarm/alarmStore';
import {
  requestNotificationPermissions,
  rescheduleAll,
  handleNotificationResponse,
  triggerAlarmPlayback,
  stopAlarmAudio,
} from './src/alarm/alarmScheduler';

import LoginScreen from './src/screens/LoginScreen';
import AlarmListScreen from './src/screens/AlarmListScreen';
import EditAlarmScreen from './src/screens/EditAlarmScreen';
import RepeatPickerScreen from './src/screens/RepeatPickerScreen';
import SoundPickerScreen from './src/screens/SoundPickerScreen';
import SpotifySongSearchScreen from './src/screens/SpotifySongSearchScreen';

// Each screen carries the full working alarm so edits survive unmount/remount.
type Screen =
  | { name: 'login' }
  | { name: 'alarmList' }
  | { name: 'editAlarm'; alarm?: Alarm }
  | { name: 'repeatPicker'; alarm: Alarm }
  | { name: 'soundPicker'; alarm: Alarm }
  | { name: 'songSearch'; alarm: Alarm };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'login' });
  const { getAccessToken } = useSpotifyAuth();
  const notifListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    getAccessToken().then((token) => {
      if (token) goToAlarmList();
    });

    requestNotificationPermissions();
    rescheduleAll();

    // Fires when notification arrives while app is foregrounded OR backgrounded (not killed).
    // This is what auto-plays the alarm song without any user tap.
    notifListener.current = Notifications.addNotificationReceivedListener(async (notification) => {
      const alarmId = notification.request.content.data?.alarmId as string | undefined;
      if (!alarmId) return;
      const { loadAlarms } = await import('./src/alarm/alarmStore');
      const alarms = await loadAlarms();
      const alarm = alarms.find((a) => a.id === alarmId);
      if (alarm) await triggerAlarmPlayback(alarm);
    });

    // Fires when user taps the notification — stop any playing audio then handle response.
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        await stopAlarmAudio();
        await handleNotificationResponse(response);
      },
    );

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  function goToAlarmList() {
    setScreen({ name: 'alarmList' });
  }

  const s = screen;

  if (s.name === 'login') {
    return <LoginScreen onLogin={goToAlarmList} />;
  }

  if (s.name === 'alarmList') {
    return (
      <AlarmListScreen
        onAdd={() => setScreen({ name: 'editAlarm', alarm: undefined })}
        onEdit={(alarm) => setScreen({ name: 'editAlarm', alarm })}
      />
    );
  }

  if (s.name === 'editAlarm') {
    return (
      <EditAlarmScreen
        alarm={s.alarm}
        onSave={goToAlarmList}
        onCancel={goToAlarmList}
        onRepeat={(alarm) => setScreen({ name: 'repeatPicker', alarm })}
        onSound={(alarm) => setScreen({ name: 'soundPicker', alarm })}
      />
    );
  }

  if (s.name === 'repeatPicker') {
    return (
      <RepeatPickerScreen
        alarm={s.alarm}
        onDone={(repeat, days) =>
          setScreen({ name: 'editAlarm', alarm: { ...s.alarm, repeat, repeatDays: days } })
        }
        onBack={() => setScreen({ name: 'editAlarm', alarm: s.alarm })}
      />
    );
  }

  if (s.name === 'soundPicker') {
    return (
      <SoundPickerScreen
        alarm={s.alarm}
        onDone={(sound) =>
          setScreen({ name: 'editAlarm', alarm: { ...s.alarm, sound } })
        }
        onPickSong={() => setScreen({ name: 'songSearch', alarm: s.alarm })}
        onBack={() => setScreen({ name: 'editAlarm', alarm: s.alarm })}
      />
    );
  }

  if (s.name === 'songSearch') {
    return (
      <SpotifySongSearchScreen
        onDone={(sound) =>
          setScreen({ name: 'editAlarm', alarm: { ...s.alarm, sound } })
        }
        onBack={() => setScreen({ name: 'soundPicker', alarm: s.alarm })}
      />
    );
  }

  return null;
}
