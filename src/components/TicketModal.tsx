import React from 'react';
import QRCode from 'qrcode';
import { Order } from '../types/pos';
import { buildPreSaleTicketEscPos, EscPosOptions } from '../utils/escpos';
import { 
  X, 
  Printer, 
  Share2, 
  Copy, 
  Download, 
  Check, 
  QrCode as QrIcon, 
  Binary, 
  FileText
} from 'lucide-react';

interface Props {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onGoToCashier?: (orderId: string) => void;
}

export const TicketModal: React.FC<Props> = ({ order, isOpen, onClose, onGoToCashier }) => {
  const [paperWidth, setPaperWidth] = React.useState<'58mm' | '80mm'>('58mm');
  const [activeTab, setActiveTab] = React.useState<'preview' | 'escpos'>('preview');
  const [qrDataUrl, setQrDataUrl] = React.useState<string>('');
  const [copiedHex, setCopiedHex] = React.useState(false);
  const [copiedText, setCopiedText] = React.useState(false);

  React.useEffect(() => {
    if (order) {
      QRCode.toDataURL(order.qrPayload || order.id, {
        width: 190,
        margin: 1,
        color: {
          dark: '#0f0e13',
          light: '#ffffff',
        },
      }).then(url => {
        setQrDataUrl(url);
      }).catch(err => {
        console.error('Error generating QR code', err);
      });
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const escPosOptions: EscPosOptions = {
    paperWidth,
    storeName: 'DULCES & BEBIDAS MAYORISTA',
    storeRuc: '20608899123',
    storeAddress: 'Av. Las Golosinas 450 - Almacén Central',
  };

  const escPosBytes = buildPreSaleTicketEscPos(order, escPosOptions);
  const hexDump = Array.from(escPosBytes)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

  const handleCopyHex = () => {
    navigator.clipboard.writeText(hexDump);
    setCopiedHex(true);
    setTimeout(() => setCopiedHex(false), 2000);
  };

  const handleCopyTextTicket = () => {
    const textLines = [
      '================================',
      'DULCES & BEBIDAS MAYORISTA',
      `TICKET PRE-VENTA: ${order.id}`,
      `FECHA: ${new Date(order.createdAt).toLocaleString('es-PE')}`,
      `VENDEDOR: ${order.sellerName}`,
      '--------------------------------',
      ...order.items.map(it => 
        `${it.quantity}x [${it.presentationType.toUpperCase()}] ${it.productName} -> S/ ${it.subtotal.toFixed(2)}`
      ),
      '--------------------------------',
      `TOTAL A PAGAR EN CAJA: S/ ${order.totalAmount.toFixed(2)}`,
      `ESTADO: ${order.status}`,
      `CÓDIGO QR ID: ${order.id}`,
      '================================',
      'Presente este ticket en Caja para pagar y despachar.'
    ].join('\n');

    navigator.clipboard.writeText(textLines);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const customerInfo = order.customerName ? `\n🏪 *Cliente:* ${order.customerName}${order.customerRuc ? ` (RUC: ${order.customerRuc})` : ''}\n💳 *Condición:* ${order.paymentTerm || 'Contado'}` : '';
    const discountInfo = order.discountAmount ? `\n🏷️ *Descuento aplicado:* -S/ ${order.discountAmount.toFixed(2)}` : '';
    const message = encodeURIComponent(
      `🍬 *TICKET DE PRE-VENTA* - ${order.id}\n` +
      `🥤 *DULCES & BEBIDAS MAYORISTA*\n` +
      `📅 Fecha: ${new Date(order.createdAt).toLocaleDateString()}\n` +
      `👤 Preventista: ${order.sellerName}` +
      customerInfo + `\n\n` +
      `*DETALLE DE PRODUCTOS:*\n` +
      order.items.map(i => `• ${i.quantity}x ${i.presentationType.toUpperCase()} ${i.productName} = S/ ${i.subtotal.toFixed(2)}`).join('\n') +
      discountInfo +
      `\n\n💰 *TOTAL A PAGAR EN CAJA:* S/ ${order.totalAmount.toFixed(2)}\n` +
      `🔖 *CÓDIGO QR / CAJA:* *${order.id}*\n` +
      `\n_Pase por Caja Central con este ticket o código para su cobro y despacho inmediato._`
    );
    window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
  };

  const handleDownloadBin = () => {
    const blob = new Blob([escPosBytes as unknown as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket_${order.id}_${paperWidth}.bin`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPDF = () => {
    const ticketHtml = document.getElementById('ticket-preview-container')?.innerHTML;
    if (!ticketHtml) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ticket ${order.id}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page { margin: 0; }
            body { 
              background: white; 
              color: black; 
              width: ${paperWidth === '58mm' ? '58mm' : '80mm'}; 
              margin: 0 auto; 
              padding: 10px;
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
            }
            .border-dashed { border-style: dashed !important; border-color: #000 !important; }
            .bg-amber-50, .bg-amber-100\\/60 { background-color: transparent !important; border: 1px solid #000 !important; }
            .text-stone-400, .text-stone-500, .text-stone-600 { color: #000 !important; }
            img { mix-blend-mode: normal !important; }
          </style>
        </head>
        <body>
          <div class="font-mono text-[11px] leading-tight text-black">
            ${ticketHtml}
          </div>
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 1000);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-in fade-in">
      <div 
        className="w-full max-w-2xl bg-stone-950 border border-amber-500/30 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col max-h-[92vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-yellow-400 text-stone-950 rounded-xl shadow-md shadow-amber-500/20">
              <Printer className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-amber-50">
                  Ticket de Pre-Venta: <span className="text-amber-400 font-mono">{order.id}</span>
                </h3>
              </div>
              <p className="text-xs text-stone-400">
                Ticket térmico ESC/POS con Código QR de alta velocidad para Caja Central
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar de opciones */}
        <div className="px-4 py-2.5 bg-stone-900/60 border-b border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Ancho del papel térmico */}
          <div className="flex items-center gap-1.5 bg-stone-950 p-1 rounded-xl border border-stone-800">
            <span className="text-stone-400 px-2 font-bold">Papel Térmico:</span>
            <button
              type="button"
              onClick={() => setPaperWidth('58mm')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                paperWidth === '58mm' 
                  ? 'bg-amber-500 text-stone-950 shadow-xs' 
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              58mm (Miniticketera)
            </button>
            <button
              type="button"
              onClick={() => setPaperWidth('80mm')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                paperWidth === '80mm' 
                  ? 'bg-amber-500 text-stone-950 shadow-xs' 
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              80mm (Mostrador)
            </button>
          </div>

          {/* Selector de Pestañas */}
          <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition ${
                activeTab === 'preview' 
                  ? 'bg-stone-800 text-amber-300' 
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Vista Previa
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('escpos')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition ${
                activeTab === 'escpos' 
                  ? 'bg-stone-800 text-amber-300' 
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Binary className="w-3.5 h-3.5" />
              Comandos ESC/POS
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-4 bg-stone-950 flex justify-center items-start">
          {activeTab === 'preview' ? (
            /* Papel Térmico Renderizado con textura realista */
            <div 
              id="ticket-preview-container"
              className={`h-max bg-[#fffef7] text-stone-900 font-mono shadow-2xl p-5 border border-amber-200/80 select-none rounded-sm ${
                paperWidth === '58mm' ? 'w-[285px] text-[11px]' : 'w-[390px] text-[12px]'
              }`}
              style={{
                boxShadow: '0 15px 35px -5px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.1)'
              }}
            >
              {/* Header */}
              <div className="text-center space-y-1 mb-2">
                <div className="font-black text-sm tracking-tight leading-snug">
                  DULCES & BEBIDAS
                </div>
                <div className="text-[10px] text-stone-600">
                  DISTRIBUCIÓN Y MAYORISTA
                </div>
                <div className="text-[9px] text-stone-500">
                  RUC: 20608899123 · ALMACÉN CENTRAL
                </div>
                <div className="border-b-2 border-dashed border-stone-400 my-2" />
                <div className="font-extrabold text-sm text-stone-900 tracking-wider">
                  *** PRE-VENTA ***
                </div>
                <div className="font-black text-lg bg-amber-50 py-0.5 rounded border border-amber-200">
                  {order.id}
                </div>
                <div className="text-[10px] text-stone-600 pt-1">
                  ESTADO: <strong>{order.status}</strong>
                </div>
                <div className="text-[10px] text-stone-600">
                  {new Date(order.createdAt).toLocaleString('es-PE')}
                </div>
                <div className="text-[10px] text-stone-600">
                  Vendedor: {order.sellerName}
                </div>
                {order.customerName && (
                  <div className="text-[10px] text-stone-800 font-bold bg-amber-100/60 p-1 rounded mt-1 text-left">
                    <div>CLIENTE: {order.customerName}</div>
                    {order.customerRuc && <div className="text-[9px] text-stone-600 font-normal">RUC/DNI: {order.customerRuc}</div>}
                    <div className="text-[9px] text-stone-600 font-normal">CONDICIÓN: {order.paymentTerm || 'Contado'}</div>
                  </div>
                )}
              </div>

              <div className="border-b border-dashed border-stone-400 my-2" />

              {/* Columnas */}
              <div className="flex justify-between font-bold text-[10px] uppercase text-stone-700 mb-1 border-b border-stone-300 pb-1">
                <span>Cant/Pres Descripción</span>
                <span>Subt.</span>
              </div>

              {/* Lista de Ítems */}
              <div className="space-y-2 my-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="leading-tight">
                    <div className="flex justify-between font-bold">
                      <span className="truncate pr-1">
                        {item.quantity}x [{item.presentationType.toUpperCase()}] {item.productName}
                      </span>
                      <span className="font-mono whitespace-nowrap">
                        S/ {item.subtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-[9px] text-stone-500 pl-2">
                      Factor: x{item.conversionFactor}u ({item.baseUnitsDeducted} base) @ S/ {item.unitPrice.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-b-2 border-dashed border-stone-400 my-2" />

              {/* Total */}
              <div className="space-y-1 my-2">
                <div className="flex justify-between font-black text-base">
                  <span>TOTAL A PAGAR:</span>
                  <span className="font-mono">S/ {order.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-stone-600">
                  <span>Ítems: {order.items.length}</span>
                  <span>Unidades Base: {order.totalBaseUnits}</span>
                </div>
              </div>

              <div className="border-b border-dashed border-stone-400 my-2" />

              {/* SECCIÓN OBLIGATORIA DEL QR PARA CAJA */}
              <div className="text-center py-2 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-stone-900">
                  LLEVE ESTE TICKET A CAJA
                </div>
                <div className="text-[9px] text-stone-600">
                  El cajero escaneará este código para cobrar:
                </div>
                
                {/* Código QR */}
                <div className="inline-block p-2 bg-white rounded-md border-2 border-stone-900 shadow-xs">
                  {qrDataUrl ? (
                    <img 
                      src={qrDataUrl} 
                      alt={`QR Code ${order.id}`} 
                      className="w-32 h-32 mx-auto mix-blend-multiply" 
                    />
                  ) : (
                    <div className="w-32 h-32 flex items-center justify-center bg-stone-100 text-stone-400">
                      <QrIcon className="w-8 h-8 animate-spin" />
                    </div>
                  )}
                </div>

                <div className="font-mono font-black text-base tracking-widest text-stone-900">
                  {order.id}
                </div>
              </div>

              <div className="border-b border-dashed border-stone-400 my-2" />

              <div className="text-center text-[9px] text-stone-500 space-y-0.5">
                <div className="font-semibold text-stone-700">** COMPROBANTE NO FISCAL **</div>
                <div>Al pagar en caja se emitirá Boleta o Factura</div>
                <div>¡Gracias por su preferencia!</div>
              </div>

              <div className="mt-4 pt-2 border-t-2 border-dotted border-stone-400 text-center text-[8px] text-stone-400 tracking-widest">
                - - - CORTE DE PAPEL ESC/POS - - -
              </div>
            </div>
          ) : (
            /* Inspector de Bytes Hexadecimales ESC/POS */
            <div className="w-full max-w-xl bg-stone-900 rounded-2xl p-4 border border-stone-800 font-mono text-xs flex flex-col space-y-3">
              <div className="flex items-center justify-between text-stone-400 text-xs border-b border-stone-800 pb-2">
                <span>Búfer binario: <strong className="text-amber-400">{escPosBytes.length} bytes</strong></span>
                <span>Ancho térmico: <strong className="text-yellow-400">{paperWidth}</strong></span>
              </div>

              <div className="text-stone-300 text-[11px] leading-relaxed">
                Flujo binario con comandos <strong className="text-amber-300">ESC/POS</strong> listos para enviar al socket RFCOMM Bluetooth SPP (<code className="text-amber-200">UUID 00001101...</code>) o impresora térmica USB OTG con soporte nativo de QR Code modelo 2 (<code className="text-amber-200">1D 28 6B ...</code>).
              </div>

              <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 max-h-64 overflow-y-auto text-amber-300 font-mono text-[11px] leading-5 break-all select-all shadow-inner">
                {hexDump}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopyHex}
                  className="flex-1 py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  {copiedHex ? <Check className="w-4 h-4 text-amber-400" /> : <Copy className="w-4 h-4" />}
                  {copiedHex ? 'Bytes Copiados' : 'Copiar Stream Hex'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadBin}
                  className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 text-xs font-black flex items-center justify-center gap-2 transition"
                >
                  <Download className="w-4 h-4" />
                  Descargar .bin
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-stone-900 border-t border-stone-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyTextTicket}
              className="py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-2 transition border border-stone-700"
            >
              {copiedText ? <Check className="w-4 h-4 text-amber-400" /> : <Copy className="w-4 h-4" />}
              {copiedText ? 'Copiado' : 'Copiar Texto'}
            </button>
            <button
              type="button"
              onClick={handleDownloadBin}
              className="py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-2 transition border border-stone-700"
            >
              <Download className="w-4 h-4" />
              Búfer ESC/POS
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onGoToCashier && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGoToCashier(order.id);
                }}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black flex items-center gap-2 transition shadow-lg shadow-blue-500/20 active:scale-98 cursor-pointer"
              >
                <QrIcon className="w-4 h-4 stroke-[2.5]" />
                Cobrar en Caja con este QR ➔
              </button>
            )}
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black flex items-center gap-2 transition shadow-lg active:scale-98 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              Compartir WhatsApp (Digital)
            </button>
            <button
              type="button"
              onClick={handlePrintPDF}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 text-xs font-black flex items-center gap-2 transition shadow-lg shadow-amber-500/20 active:scale-98 cursor-pointer"
            >
              <Printer className="w-4 h-4 stroke-[2.5]" />
              Imprimir Ticket / PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
