import type { Order, StoreSettings } from '../types/pos';
import { shareFile } from './shareFile';
import { renderTicketImage } from './ticketImage';

/** Comparte el ticket como IMAGEN (no como texto). Devuelve false si el usuario canceló. */
export async function shareTicketImage(order: Order, settings?: StoreSettings): Promise<boolean> {
  const canvas = await renderTicketImage(order, settings);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen.'))), 'image/png'));
  return shareFile(blob, `ticket-${order.code}.png`, `Ticket ${order.code}`, `Ticket ${order.code} · Total S/ ${order.totalAmount.toFixed(2)}`);
}
