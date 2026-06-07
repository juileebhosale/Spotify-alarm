export default {
  expo: {
    name: 'spotify-alarm',
    slug: 'spotify-alarm',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: false,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    scheme: 'spotify-alarm',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.juileeb.spotifyalarm',
      infoPlist: {
        NSUserNotificationsUsageDescription:
          'Alarm notifications are used to wake you up at scheduled times.',
        UIBackgroundModes: ['audio', 'fetch'],
        ITSAppUsesNonExemptEncryption: false,
        SpotifyClientID: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID,
        SpotifyRedirectURL: 'spotify-alarm://callback',
        LSApplicationQueriesSchemes: ['spotify'],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      eas: {
        projectId: 'a3b7b110-bdf6-42c9-b11c-eae81fe8baba',
      },
    },
    owner: 'juileeb',
    plugins: [
      'expo-web-browser',
      'expo-secure-store',
      '@react-native-community/datetimepicker',
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#FF9500',
          sounds: ['./assets/alarm.wav'],
        },
      ],
      'expo-audio',
    ],
  },
};
