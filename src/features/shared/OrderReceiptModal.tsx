import React from 'react';
import { Receipt, X } from 'lucide-react';
import type { Order } from '../../types/pos';

interface Props {
  order: Order;
  onClose: () => void;
  children?: React.ReactNode;
}

/** Vista de una boleta/ticket con su detalle, pagos y saldo. */
export const OrderReceiptModal: React.FC<Props> = ({ order, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in" onClick={onClose}>
    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-emerald-600" />
          <h3 className="font-black text-sm uppercase text-slate-800">Ticket {order.code}</h3>
        </div>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Cerrar"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-5 overflow-y-auto font-mono text-xs space-y-1 text-slate-700">
        <div className="flex justify-between"><span>Fecha:</span> <span>{new Date(order.createdAt).toLocaleString('es-PE')}</span></div>
        <div className="flex justify-between"><span>Vendedor:</span> <span>{order.sellerName}</span></div>
        <div className="flex justify-between"><span>Cliente:</span> <span>{order.customerName || '-'}</span></div>
        <div className="flex justify-between"><span>DNI/RUC:</span> <span>{order.customerRuc || '-'}</span></div>
        <div className="flex justify-between"><span>Condición:</span> <span>{order.paymentTerm}</span></div>
        <div className="flex justify-between"><span>Estado:</span> <span className="font-black">{order.status}</span></div>
        {order.cancelReason && <div className="text-red-600">Motivo anulación: {order.cancelReason}</div>}
        <div className="border-t border-dashed border-slate-300 my-2" />
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between gap-2">
            <span className="truncate">{item.quantity}x {item.presentationType.toUpperCase()} {item.productName}</span>
            <span>S/ {item.subtotal.toFixed(2)}</span>
          </div>
        ))}
        <div className="border-t border-dashed border-slate-300 my-2" />
        {!!order.discountAmount && (
          <div className="flex justify-between"><span>Descuento:</span><span>- S/ {order.discountAmount.toFixed(2)}</span></div>
        )}
        <div className="flex justify-between font-black text-sm text-slate-900"><span>TOTAL:</span><span>S/ {order.totalAmount.toFixed(2)}</span></div>
        <div className="flex justify-between text-emerald-700"><span>Pagado:</span><span>S/ {(order.paidAmount || 0).toFixed(2)}</span></div>
        <div className="flex justify-between text-red-600 font-black"><span>Saldo:</span><span>S/ {(order.debtAmount || 0).toFixed(2)}</span></div>
        {order.paymentMethod && <div className="text-slate-500">Medio de pago: {order.paymentMethod}</div>}
      </div>
      {children && <div className="p-4 border-t border-slate-100 space-y-2">{children}</div>}
    </div>
  </div>
);
