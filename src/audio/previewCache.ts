import * as FileSystem from 'expo-file-system/legacy';

const PREVIEW_DIR = FileSystem.documentDirectory + 'previews/';
// Library/Sounds is where iOS looks for custom notification sounds (persists across launches).
const SOUNDS_DIR = FileSystem.documentDirectory!.replace('Documents/', 'Library/Sounds/');

export interface CachedPreview {
  localPreviewUri: string;       // file:// URI used by expo-av when app is alive
  notificationSoundFile: string; // filename only (e.g. 'ap_abc123.mp3') — iOS reads this from Library/Sounds
}

// Downloads the 30s preview MP3 for a track, saves it to both the previews dir (for expo-av)
// and Library/Sounds (so iOS can play it as the notification sound when the app is killed).
// Returns null if previewUrl is not provided or download fails.
export async function cachePreview(
  trackUri: string,
  previewUrl: string | undefined,
): Promise<CachedPreview | null> {
  if (!previewUrl) return null;

  await FileSystem.makeDirectoryAsync(PREVIEW_DIR, { intermediates: true });
  await FileSystem.makeDirectoryAsync(SOUNDS_DIR, { intermediates: true });

  const trackId = trackUri.split(':').pop()!;
  const localPath = PREVIEW_DIR + trackId + '.mp3';
  const soundFileName = `ap_${trackId}.mp3`;
  const soundPath = SOUNDS_DIR + soundFileName;

  const [localInfo, soundInfo] = await Promise.all([
    FileSystem.getInfoAsync(localPath),
    FileSystem.getInfoAsync(soundPath),
  ]);

  if (localInfo.exists && soundInfo.exists) {
    return { localPreviewUri: localPath, notificationSoundFile: soundFileName };
  }

  try {
    if (!localInfo.exists) {
      const result = await FileSystem.downloadAsync(previewUrl, localPath);
      if (result.status !== 200) {
        await FileSystem.deleteAsync(localPath, { idempotent: true });
        return null;
      }
    }
    if (!soundInfo.exists) {
      await FileSystem.copyAsync({ from: localPath, to: soundPath });
    }
    return { localPreviewUri: localPath, notificationSoundFile: soundFileName };
  } catch {
    await FileSystem.deleteAsync(localPath, { idempotent: true });
    await FileSystem.deleteAsync(soundPath, { idempotent: true });
    return null;
  }
}
