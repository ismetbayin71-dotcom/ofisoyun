/**
 * Extracts 11-character YouTube video ID from various YouTube URL formats.
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://music.youtube.com/watch?v=VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - Direct 11-char ID
 */
export function extractYouTubeVideoId(url) {
  if (!url) return null;
  const trimmed = url.trim();

  // 1. If already 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. Standard watch, shorts, embed, youtu.be, music.youtube URLs
  const regExp = /(?:youtube(?:-nocookie)?\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regExp);
  return match ? match[1] : null;
}

/**
 * Resizes, crops to square, and converts user-uploaded PNG/JPEG images into optimized Base64 Data URLs.
 */
export function processAvatarImage(file, maxSize = 120) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Dosya seçilmedi.'));
    if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/)) {
      return reject(new Error('Yalnızca PNG veya JPEG formatları desteklenmektedir.'));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const width = img.width;
        const height = img.height;

        // Crop to centered square
        const minDim = Math.min(width, height);
        const startX = (width - minDim) / 2;
        const startY = (height - minDim) / 2;

        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, maxSize, maxSize);

        const format = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(format, 0.85);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Resim dosyası açılamadı.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsDataURL(file);
  });
}
