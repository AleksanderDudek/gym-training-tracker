/**
 * One frame of the live camera as a JPEG, for the meal photo. The long side is capped: the model
 * reads 224 × 224 and the screen shows a thumbnail, so a 12 MP still would only cost memory.
 */
const LONG_SIDE = 1280;

export function grabFrame(video: HTMLVideoElement): Promise<Blob> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return Promise.reject(new Error('no camera frame yet'));
  const f = Math.min(1, LONG_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * f);
  canvas.height = Math.round(h * f);
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('no 2d context'));
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no frame'))), 'image/jpeg', 0.9));
}
