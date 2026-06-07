import * as FileSystem from 'expo-file-system/legacy';

const PREVIEW_DIR = FileSystem.documentDirectory + 'previews/';

// Downloads the 30s preview MP3 for a track and returns the local file URI.
// If already cached, returns the existing path immediately.
// Returns null if previewUrl is not provided.
export async function cachePreview(
  trackUri: string,
  previewUrl: string | undefined,
): Promise<string | null> {
  if (!previewUrl) return null;

  await FileSystem.makeDirectoryAsync(PREVIEW_DIR, { intermediates: true });

  const trackId = trackUri.split(':').pop()!;
  const localPath = PREVIEW_DIR + trackId + '.mp3';

  const info = await FileSystem.getInfoAsync(localPath);
  if (info.exists) return localPath;

  try {
    const result = await FileSystem.downloadAsync(previewUrl, localPath);
    if (result.status === 200) return localPath;
    // Download failed — clean up any partial file
    await FileSystem.deleteAsync(localPath, { idempotent: true });
    return null;
  } catch {
    await FileSystem.deleteAsync(localPath, { idempotent: true });
    return null;
  }
}
