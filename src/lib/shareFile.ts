import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Comparte un archivo (imagen, PDF…) con el menú de compartir de Android (WhatsApp, correo,
 * Drive…). En el navegador usa Web Share o lo descarga. Devuelve false si el usuario canceló.
 */
export async function shareFile(blob: Blob, fileName: string, title: string, text?: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const base64 = await blobToBase64(blob);
      const { uri } = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
      await Share.share({ title, text, files: [uri], dialogTitle: title });
      return true;
    }
    const file = new File([blob], fileName, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title, text });
      return true;
    }
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  } catch (e) {
    // Cerrar el menú de compartir no es un error.
    const msg = e instanceof Error ? e.message.toLowerCase() : '';
    if (msg.includes('cancel') || (e instanceof DOMException && e.name === 'AbortError')) return false;
    throw e;
  }
}

const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
  reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo.'));
  reader.readAsDataURL(blob);
});
