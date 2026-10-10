/**
 * Reduce una foto de producto lo más posible antes de subirla:
 * recorte cuadrado al centro, 256 px, WebP con calidad decreciente hasta pesar
 * ~12 KB como máximo. Si el navegador no sabe generar WebP (iPhone), usa JPEG.
 */

const SIZE = 256;
const TARGET_BYTES = 12_000;
const MIN_QUALITY = 0.38;

const loadImage = (file: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la foto.')); };
    img.src = url;
  });

/** Tamaño real en bytes de un data URL base64. */
export const dataUrlBytes = (dataUrl: string): number =>
  Math.floor(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);

export async function compressProductPhoto(file: Blob): Promise<string> {
  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  if (!side) throw new Error('La foto está vacía.');

  let size = SIZE;
  let best = '';
  // Si aun con calidad mínima pesa mucho, se baja el tamaño (256 → 208 → 168).
  for (let attempt = 0; attempt < 3; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('El celular no pudo procesar la foto.');
    ctx.fillStyle = '#ffffff'; // fondo blanco si la imagen tiene transparencia
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);

    const probe = canvas.toDataURL('image/webp', 0.7);
    const type = probe.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
    for (let q = 0.7; q >= MIN_QUALITY; q -= 0.08) {
      best = canvas.toDataURL(type, q);
      if (dataUrlBytes(best) <= TARGET_BYTES) return best;
    }
    size = Math.round(size * 0.81);
  }
  return best;
}
