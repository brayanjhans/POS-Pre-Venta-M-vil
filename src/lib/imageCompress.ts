/**
 * Reduce una foto lo más posible antes de subirla: recorte al centro con la proporción
 * pedida, tamaño chico, WebP con calidad decreciente hasta el peso objetivo. Si el
 * navegador no sabe generar WebP (iPhone), usa JPEG.
 *  - Producto: cuadrada 256 px, ~12 KB.
 *  - Combo: 480x300 px (se ve más grande en el banner), ~22 KB.
 */

interface PhotoSpec { width: number; height: number; targetBytes: number }
const PRODUCT: PhotoSpec = { width: 256, height: 256, targetBytes: 12_000 };
const COMBO: PhotoSpec = { width: 480, height: 300, targetBytes: 22_000 };
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

async function compressPhoto(file: Blob, spec: PhotoSpec): Promise<string> {
  const img = await loadImage(file);
  const { naturalWidth: w, naturalHeight: h } = img;
  if (!w || !h) throw new Error('La foto está vacía.');
  // Recorte al centro con la proporción final.
  const ratio = spec.width / spec.height;
  const cropW = w / h > ratio ? h * ratio : w;
  const cropH = cropW / ratio;

  let scale = 1;
  let best = '';
  // Si aun con calidad mínima pesa mucho, se achica (100 % → 81 % → 66 %).
  for (let attempt = 0; attempt < 3; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(spec.width * scale);
    canvas.height = Math.round(spec.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('El celular no pudo procesar la foto.');
    ctx.fillStyle = '#ffffff'; // fondo blanco si la imagen tiene transparencia
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (w - cropW) / 2, (h - cropH) / 2, cropW, cropH, 0, 0, canvas.width, canvas.height);

    const probe = canvas.toDataURL('image/webp', 0.7);
    const type = probe.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
    for (let q = 0.7; q >= MIN_QUALITY; q -= 0.08) {
      best = canvas.toDataURL(type, q);
      if (dataUrlBytes(best) <= spec.targetBytes) return best;
    }
    scale *= 0.81;
  }
  return best;
}

export const compressProductPhoto = (file: Blob) => compressPhoto(file, PRODUCT);
export const compressComboPhoto = (file: Blob) => compressPhoto(file, COMBO);
