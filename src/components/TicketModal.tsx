import React from 'react';
import QRCode from 'qrcode';
import { Order } from '../types/pos';
import { EscPosOptions } from '../utils/escpos';
import { 
  X, 
  Printer, 
  Share2, 
  Copy, 
  Check, 
  QrCode as QrIcon
} from 'lucide-react';

interface Props {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onGoToCashier?: (orderId: string) => void;
}

export const TicketModal: React.FC<Props> = ({ order, isOpen, onClose, onGoToCashier }) => {
  const [paperWidth, setPaperWidth] = React.useState<'58mm' | '80mm'>('58mm');
  const [qrDataUrl, setQrDataUrl] = React.useState<string>('');
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

  if (!isOpen || !order) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
      <div 
        className="w-full max-w-lg bg-white rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.4)] ring-1 ring-black/5 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Elegante */}
        <div className="px-6 py-4 flex items-center justify-between bg-white relative z-10 shadow-sm shadow-slate-100/50 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600 rounded-2xl shadow-sm border border-emerald-100/50">
              <Printer className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none">
                Ticket Generado
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                ID: <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-md">{order.id}</span>
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 transition shadow-sm border border-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido (Ticket con efecto de papel) */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
          <div className="flex flex-col items-center w-full pb-8">
            {/* Selector de Papel */}
            <div className="flex bg-slate-200/50 p-1.5 rounded-xl w-max mb-6 shadow-inner">
            <button
              onClick={() => setPaperWidth('58mm')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition duration-200 ${paperWidth === '58mm' ? 'bg-white text-slate-800 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Mini (58mm)
            </button>
            <button
              onClick={() => setPaperWidth('80mm')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition duration-200 ${paperWidth === '80mm' ? 'bg-white text-slate-800 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Estándar (80mm)
            </button>
          </div>

          <div 
            id="ticket-preview-container" 
            className={`bg-[#fcfdfa] shadow-[0_8px_30px_rgb(0,0,0,0.08)] border-x border-slate-200/60 relative overflow-hidden transition-all duration-300 mx-auto ${paperWidth === '58mm' ? 'w-[58mm]' : 'w-[80mm]'}`}
            style={{ minHeight: '100mm' }}
          >
            {/* Efecto de borde zigzag arriba y abajo simulando papel de recibo */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjQiPjxwb2x5Z29uIHBvaW50cz0iMCwwIDQsNCA4LDAiIGZpbGw9IiNmOGZhZmMiLz48L3N2Zz4=')] bg-repeat-x"></div>
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjQiPjxwb2x5Z29uIHBvaW50cz0iMCw0IDQsMCA4LDQiIGZpbGw9IiNmOGZhZmMiLz48L3N2Zz4=')] bg-repeat-x"></div>

            {/* Render del Ticket Real */}
            <div className="p-4 pt-6 pb-6 font-mono text-[11px] leading-tight text-slate-900 flex flex-col items-stretch">
              <div className="text-center mb-4">
                <div className="font-black text-[13px] uppercase tracking-wider mb-1">DULCES & BEBIDAS</div>
                <div className="text-[10px]">DISTRIBUCIÓN Y MAYORISTA</div>
                <div className="text-[10px]">RUC: 20608899123</div>
              </div>

              <div className="border-b border-dashed border-slate-300 pb-2 mb-2 text-center font-bold">
                *** PRE-VENTA ***
              </div>

              <div className="text-center font-black text-[15px] py-1 border border-slate-200 bg-slate-50 rounded mb-3 tracking-wider">
                {order.id}
              </div>

              <div className="text-[10px] space-y-0.5 mb-3">
                <div>ESTADO: {order.status}</div>
                <div>FECHA: {new Date(order.createdAt).toLocaleString()}</div>
                <div>VENDEDOR: {order.sellerName}</div>
              </div>

              <div className="bg-slate-50 p-2 border border-slate-100 rounded mb-3 text-[10px] space-y-0.5">
                <div className="font-bold">CLIENTE: {order.customerName || 'Cliente General'}</div>
                {order.customerRuc && <div>DNI/RUC: {order.customerRuc}</div>}
                <div>CONDICIÓN: {order.paymentTerm || 'Contado'}</div>
              </div>

              <table className="w-full text-[10px] mb-3">
                <thead className="border-b border-dashed border-slate-300">
                  <tr>
                    <th className="text-left py-1 font-bold">CANT</th>
                    <th className="text-left py-1 font-bold">DESCRIPCIÓN</th>
                    <th className="text-right py-1 font-bold">SUBT.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-slate-100">
                  {order.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-1.5 align-top font-bold">{item.quantity}x</td>
                      <td className="py-1.5 px-1 align-top break-words max-w-[120px]">
                        [{item.presentationType.toUpperCase().substring(0,4)}] {item.productName}
                      </td>
                      <td className="py-1.5 text-right align-top font-bold text-slate-800">S/ {item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-dashed border-slate-300 pt-2 mb-4 space-y-1">
                {order.discountAmount ? (
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Descuento:</span>
                    <span>- S/ {order.discountAmount.toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-black text-[13px] pt-1">
                  <span>TOTAL A PAGAR:</span>
                  <span>S/ {order.totalAmount.toFixed(2)}</span>
                </div>
              </div>
              
              {order.returnedContainers && order.returnedContainers > 0 ? (
                <div className="border-b border-dashed border-slate-300 pb-2 mb-3">
                  <div className="flex justify-between font-bold text-[11px] text-slate-700 bg-slate-100 p-1.5 rounded">
                    <span>Envases Devueltos:</span>
                    <span>{order.returnedContainers} unid.</span>
                  </div>
                </div>
              ) : null}

              {order.debtAmount && order.debtAmount > 0 ? (
                <div className="border border-slate-300 rounded p-1.5 mb-3 text-center bg-slate-50">
                  <span className="font-bold text-[10px] text-slate-800 uppercase block">AVISO: SALDO PENDIENTE</span>
                  <span className="text-[9px] text-slate-600 font-medium">
                    Evite el bloqueo de sus créditos.
                  </span>
                </div>
              ) : null}

              <div className="flex justify-center mb-3 mt-1">
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="QR Code" className="w-32 h-32 opacity-90" style={{ mixBlendMode: 'multiply' }} />
                )}
              </div>

              <div className="text-center text-[9px] text-slate-500 leading-tight">
                Pase por Caja Central con este QR para cobrar y despachar su mercadería.
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Footer Actions Claras y Modernas */}
        <div className="p-5 bg-white border-t border-slate-100 rounded-b-3xl shrink-0">
          {onGoToCashier && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onGoToCashier(order.id);
              }}
              className="w-full mb-3 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-[13px] font-black uppercase tracking-wider rounded-xl shadow-[0_8px_20px_-6px_rgba(5,150,105,0.5)] border border-emerald-400/30 flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.98]"
            >
              <div className="bg-white/20 p-1.5 rounded-lg">
                <QrIcon className="w-5 h-5 stroke-[2.5]" />
              </div>
              Cobrar en Caja con QR
            </button>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={handlePrintPDF}
              className="py-3 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-bold uppercase flex flex-col items-center justify-center gap-1.5 transition duration-200 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.3)] active:scale-[0.97]"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="py-3 px-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-[10px] font-bold uppercase flex flex-col items-center justify-center gap-1.5 transition duration-200 shadow-[0_4px_12px_-4px_rgba(37,211,102,0.4)] active:scale-[0.97]"
            >
              <Share2 className="w-4 h-4" />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={handleCopyTextTicket}
              className="py-3 px-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm rounded-xl text-[10px] font-bold uppercase flex flex-col items-center justify-center gap-1.5 transition duration-200 active:scale-[0.97]"
            >
              {copiedText ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copiedText ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
