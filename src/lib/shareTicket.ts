import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { Order, StoreSettings } from '../types/pos';
import { renderTicketImage } from './ticketImage';

/**
 * Comparte el ticket como IMAGEN (no como texto). En el celular abre el menú de compartir de
 * Android para elegir WhatsApp y el contacto; en el navegador usa Web Share o descarga el PNG.
 * Devuelve false si el usuario canceló.
 */
export async function shareTicketImage(order: Order, settings?: StoreSettings): Promise<boolean> {
  const canvas = await renderTicketImage(order, settings);
  const fileName = `ticket-${order.code}.png`;
  const caption = `Ticket ${order.code} · Total S/ ${order.totalAmount.toFixed(2)}`;

  try {
    if (Capacitor.isNativePlatform()) {
      const base64 = canvas.toDataURL('image/png').split(',')[1];
      const { uri } = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
      await Share.share({ title: `Ticket ${order.code}`, text: caption, files: [uri], dialogTitle: 'Enviar ticket' });
      return true;
    }

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen.'))), 'image/png'));
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `Ticket ${order.code}`, text: caption });
      return true;
    }
    // Sin "compartir" (PC): se descarga la imagen para adjuntarla en WhatsApp Web.
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
