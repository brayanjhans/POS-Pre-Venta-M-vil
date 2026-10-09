import QRCode from 'qrcode';
import type { Order, StoreSettings } from '../types/pos';

/**
 * Dibuja el ticket/boleta como imagen PNG (estilo ticket térmico) para enviarlo por WhatsApp.
 * Se dibuja en un canvas en lugar de capturar el HTML: sale igual en cualquier celular.
 */

const W = 640; // ancho en px (nítido en pantallas de celular)
const PAD = 40;
const INK = '#0f172a';
const MUTED = '#64748b';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

const money = (n: number | null | undefined) => `S/ ${(Number(n) || 0).toFixed(2)}`;

const STATUS_LABEL: Record<Order['status'], string> = {
  PENDIENTE_PAGO: 'PENDIENTE DE PAGO',
  PAGADO: 'PAGADO',
  FIADO: 'FIADO',
  CANCELADO: 'ANULADO',
};

export async function renderTicketImage(order: Order, settings?: StoreSettings): Promise<HTMLCanvasElement> {
  const draft = document.createElement('canvas');
  draft.width = W;
  draft.height = 6000;
  const ctx = draft.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, draft.height);
  ctx.textBaseline = 'top';
  let y = PAD;

  const text = (value: string, opts: { size?: number; weight?: number; color?: string; align?: CanvasTextAlign; font?: string; x?: number } = {}) => {
    const size = opts.size ?? 24;
    ctx.font = `${opts.weight ?? 400} ${size}px ${opts.font ?? FONT}`;
    ctx.fillStyle = opts.color ?? INK;
    ctx.textAlign = opts.align ?? 'left';
    const x = opts.x ?? (opts.align === 'center' ? W / 2 : opts.align === 'right' ? W - PAD : PAD);
    ctx.fillText(value, x, y);
  };
  /** Parte un texto en líneas que entren en maxWidth. */
  const wrap = (value: string, maxWidth: number, font: string): string[] => {
    ctx.font = font;
    const words = value.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };
  const row = (left: string, right: string, opts: { size?: number; weight?: number; color?: string } = {}) => {
    text(left, { ...opts, align: 'left' });
    text(right, { ...opts, align: 'right', font: MONO });
    y += (opts.size ?? 24) + 12;
  };
  const dashed = () => {
    y += 6;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    ctx.setLineDash([]);
    y += 22;
  };

  // --- Encabezado de la tienda ---
  const storeName = settings?.store_name || 'DULCES & BEBIDAS MAYORISTA';
  for (const line of wrap(storeName.toUpperCase(), W - PAD * 2, `800 34px ${FONT}`)) {
    text(line, { size: 34, weight: 800, align: 'center' });
    y += 42;
  }
  if (settings?.store_ruc) { text(`RUC ${settings.store_ruc}`, { size: 20, color: MUTED, align: 'center' }); y += 28; }
  if (settings?.store_address) {
    for (const line of wrap(settings.store_address, W - PAD * 2, `400 20px ${FONT}`)) {
      text(line, { size: 20, color: MUTED, align: 'center' });
      y += 26;
    }
  }
  y += 10;

  // --- Etiqueta del ticket ---
  const isFiado = order.status === 'FIADO' || (order.debtAmount ?? 0) > 0;
  const badge = order.status === 'CANCELADO' ? '#dc2626' : isFiado ? '#ea580c' : order.status === 'PAGADO' ? '#059669' : '#0f172a';
  ctx.fillStyle = badge;
  ctx.beginPath();
  ctx.roundRect(PAD, y, W - PAD * 2, 92, 18);
  ctx.fill();
  y += 14;
  text(isFiado ? 'NOTA DE VENTA · FIADO' : 'TICKET DE PRE-VENTA', { size: 22, weight: 700, color: '#ffffffcc', align: 'center' });
  y += 30;
  text(order.code, { size: 34, weight: 800, color: '#ffffff', align: 'center', font: MONO });
  y += 64;

  // --- Datos ---
  row('Fecha', new Date(order.createdAt).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }), { size: 22, color: MUTED });
  row('Vendedor', order.sellerName, { size: 22, color: MUTED });
  if (order.customerName) row('Cliente', order.customerName.slice(0, 28), { size: 22, weight: 700 });
  if (order.customerRuc) row('DNI/RUC', order.customerRuc, { size: 22, color: MUTED });
  row('Condición', order.paymentTerm ?? 'Contado', { size: 22, color: MUTED });
  row('Estado', STATUS_LABEL[order.status], { size: 22, weight: 700, color: badge });
  dashed();

  // --- Productos ---
  for (const item of order.items) {
    for (const line of wrap(item.productName, W - PAD * 2, `700 24px ${FONT}`)) {
      text(line, { size: 24, weight: 700 });
      y += 30;
    }
    const detail = `${item.quantity} × ${item.presentationLabel || item.presentationType.toUpperCase()}  @ ${money(item.unitPrice)}`;
    text(detail, { size: 21, color: MUTED });
    text(money(item.subtotal), { size: 24, weight: 700, align: 'right', font: MONO });
    y += 40;
  }
  dashed();

  // --- Totales ---
  if (order.discountAmount) {
    row('Subtotal', money(order.grossAmount ?? order.totalAmount + order.discountAmount), { size: 22, color: MUTED });
    row(`Descuento ${order.discountPercent ? `(${order.discountPercent}%)` : ''}`, `- ${money(order.discountAmount)}`, { size: 22, color: MUTED });
  }
  text('TOTAL', { size: 30, weight: 800 });
  text(money(order.totalAmount), { size: 36, weight: 800, align: 'right', font: MONO });
  y += 52;
  if (isFiado || order.status === 'PAGADO') {
    row('Pagado', money(order.paidAmount), { size: 22, color: '#059669', weight: 700 });
  }
  if ((order.debtAmount ?? 0) > 0) {
    row('SALDO PENDIENTE', money(order.debtAmount), { size: 26, color: '#dc2626', weight: 800 });
  }
  if (order.returnedContainers) row('Envases devueltos', String(order.returnedContainers), { size: 22, color: MUTED });

  // --- QR ---
  if (order.status !== 'CANCELADO') {
    y += 16;
    const qr = document.createElement('canvas');
    await QRCode.toCanvas(qr, order.qrPayload || order.code, { width: 240, margin: 1, color: { dark: INK, light: '#ffffff' } });
    ctx.drawImage(qr, (W - 240) / 2, y);
    y += 252;
    text(order.code, { size: 22, weight: 700, align: 'center', font: MONO });
    y += 34;
  }

  // --- Pie ---
  const footer = order.status === 'PENDIENTE_PAGO'
    ? 'Presente este ticket en caja para pagar y recoger.'
    : (order.debtAmount ?? 0) > 0 ? 'Gracias por su preferencia. Pague su saldo en caja.' : '¡Gracias por su compra!';
  for (const line of wrap(footer, W - PAD * 2, `500 21px ${FONT}`)) {
    text(line, { size: 21, weight: 500, color: MUTED, align: 'center' });
    y += 28;
  }
  y += PAD - 10;

  // Recorta al alto usado.
  const out = document.createElement('canvas');
  out.width = W;
  out.height = Math.ceil(y);
  out.getContext('2d')!.drawImage(draft, 0, 0);
  return out;
}
