import React from 'react';
import { ArrowLeft, CheckCircle2, HandCoins, Receipt, RefreshCw } from 'lucide-react';
import { formatSoles, parseAmount } from '../../domain/money';
import { usePos } from '../../state/PosContext';
import { OrderReceiptModal } from './OrderReceiptModal';
import { PAYMENT_METHODS, type CustomerStatement, type DebtorSummary, type Order, type PaymentMethod } from '../../types/pos';

const KIND_LABEL = { VENTA: 'Pago en venta', ABONO: 'Abono', DEVOLUCION: 'Devolución' } as const;

/**
 * Libreta de fiados: clientes con deuda, su estado de cuenta (boletas + historial de pagos)
 * y registro de abonos. Lo usan el admin y la caja.
 */
export const DebtsPanel: React.FC = () => {
  const { api, handleError, refreshCatalog, refreshOrders } = usePos();
  const [debtors, setDebtors] = React.useState<DebtorSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statement, setStatement] = React.useState<CustomerStatement | null>(null);
  const [viewOrder, setViewOrder] = React.useState<Order | null>(null);
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState<PaymentMethod>('Efectivo');
  const [targetOrderId, setTargetOrderId] = React.useState<string>('');
  const [notes, setNotes] = React.useState('');
  const [message, setMessage] = React.useState<{ text: string; error?: boolean } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const loadDebtors = React.useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      setDebtors(await api.debts());
    } catch (e) {
      setMessage({ text: handleError(e), error: true });
    } finally {
      setLoading(false);
    }
  }, [api, handleError]);

  React.useEffect(() => { void loadDebtors(); }, [loadDebtors]);

  const openStatement = async (customerId: string) => {
    if (!api) return;
    try {
      setStatement(await api.customerStatement(customerId));
      setAmount('');
      setTargetOrderId('');
      setNotes('');
      setMessage(null);
    } catch (e) {
      setMessage({ text: handleError(e), error: true });
    }
  };

  const openOrders = statement?.orders.filter(o => o.status === 'FIADO' && (o.debtAmount ?? 0) > 0) ?? [];
  const totalDebt = openOrders.reduce((acc, o) => acc + (o.debtAmount ?? 0), 0);
  const maxForTarget = targetOrderId ? openOrders.find(o => o.id === targetOrderId)?.debtAmount ?? 0 : totalDebt;

  const submitAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!api || !statement) return;
    const value = parseAmount(amount);
    if (Number.isNaN(value) || value <= 0) {
      setMessage({ text: 'Ingrese un monto válido.', error: true });
      return;
    }
    if (value > maxForTarget + 0.001) {
      setMessage({ text: `El abono supera la deuda (${formatSoles(maxForTarget)}).`, error: true });
      return;
    }
    setSaving(true);
    try {
      const result = await api.registerAbono({
        customerId: statement.customer.id, amount: value, method, orderId: targetOrderId || null, notes: notes.trim() || undefined,
      });
      setMessage({
        text: `✓ Abono de ${formatSoles(value)} registrado en ${result.applied.map(a => a.orderCode).join(', ')}. ` +
              `Deuda restante: ${formatSoles(result.remainingDebt)}.`,
      });
      await openStatement(statement.customer.id);
      void loadDebtors();
      void refreshCatalog();
      void refreshOrders();
    } catch (err) {
      setMessage({ text: handleError(err), error: true });
    } finally {
      setSaving(false);
    }
  };

  if (statement) {
    const c = statement.customer;
    return (
      <div className="space-y-4 animate-in fade-in">
        <button type="button" onClick={() => { setStatement(null); setMessage(null); }}
          className="text-xs font-bold text-slate-500 flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Volver a deudores</button>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-900">{c.name}</h3>
            <div className="text-xs text-slate-500">
              {c.docType !== 'NINGUNO' ? `${c.docType} ${c.docNumber}` : 'Sin documento'}{c.route ? ` · ${c.route}` : ''}{c.phone ? ` · ☎ ${c.phone}` : ''}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-500">Deuda fiada</div>
            <div className="text-2xl font-black text-red-600 font-mono">{formatSoles(totalDebt)}</div>
            <div className="text-[10px] text-slate-500">Límite: {formatSoles(c.creditLimit)}</div>
          </div>
        </div>

        {message && (
          <div className={`text-xs font-bold px-3 py-2 rounded-lg border ${message.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
            {message.text}
          </div>
        )}

        {totalDebt > 0 && (
          <form onSubmit={submitAbono} className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
            <h4 className="font-black text-sm uppercase text-emerald-900 flex items-center gap-2"><HandCoins className="w-4 h-4" /> Registrar abono</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <input type="text" inputMode="decimal" placeholder="Monto S/" value={amount} onChange={e => setAmount(e.target.value)} required
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono font-black" />
              <select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)} className="bg-white border border-slate-300 rounded-xl px-2 py-2 text-sm">
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={targetOrderId} onChange={e => setTargetOrderId(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-2 py-2 text-sm col-span-2">
                <option value="">Aplicar a la deuda más antigua primero</option>
                {openOrders.map(o => <option key={o.id} value={o.id}>Solo {o.code} (debe {formatSoles(o.debtAmount)})</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <input type="text" placeholder="Nota (opcional)" value={notes} onChange={e => setNotes(e.target.value)}
                className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm" />
              <button type="button" onClick={() => setAmount(maxForTarget.toFixed(2))} className="px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold">
                Total
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-[#16a34a] text-white rounded-xl font-black text-xs uppercase disabled:opacity-50">
                {saving ? '…' : 'Abonar'}
              </button>
            </div>
          </form>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h4 className="font-black text-sm uppercase mb-2">Boletas a crédito</h4>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {statement.orders.length === 0 && <p className="text-xs text-slate-400">Sin boletas a crédito.</p>}
              {statement.orders.map(o => (
                <button key={o.id} type="button" onClick={() => setViewOrder(o)}
                  className="w-full flex justify-between items-center p-2.5 rounded-xl border border-slate-100 hover:border-emerald-400 text-left text-xs">
                  <div>
                    <div className="font-mono font-bold">{o.code} <span className={`ml-1 px-1.5 rounded text-[10px] ${o.status === 'FIADO' ? 'bg-orange-100 text-orange-800' : o.status === 'PAGADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{o.status}</span></div>
                    <div className="text-[10px] text-slate-500">{new Date(o.createdAt).toLocaleDateString('es-PE')} · total {formatSoles(o.totalAmount)}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono font-black ${(o.debtAmount ?? 0) > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatSoles(o.debtAmount)}</div>
                    <Receipt className="w-3.5 h-3.5 text-slate-400 ml-auto" />
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h4 className="font-black text-sm uppercase mb-2">Historial de pagos</h4>
            <div className="space-y-1.5 max-h-80 overflow-y-auto text-xs">
              {statement.payments.length === 0 && <p className="text-slate-400">Sin pagos registrados.</p>}
              {statement.payments.map(p => (
                <div key={p.id} className="flex justify-between border-b border-slate-100 py-1.5">
                  <div>
                    <div className="font-bold">{KIND_LABEL[p.kind]} · {p.method}</div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(p.createdAt).toLocaleString('es-PE')} · {p.orderCode} · {p.receivedBy}{p.notes ? ` · ${p.notes}` : ''}
                    </div>
                  </div>
                  <div className={`font-mono font-black ${p.amount < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatSoles(p.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {viewOrder && <OrderReceiptModal order={viewOrder} onClose={() => setViewOrder(null)} />}
      </div>
    );
  }

  const q = search.toLowerCase().trim();
  const filtered = debtors.filter(d => !q || d.name.toLowerCase().includes(q) || (d.docNumber ?? '').includes(q));
  const grandTotal = debtors.reduce((acc, d) => acc + d.fiadoDebt, 0);

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h3 className="text-xl font-black text-slate-900 uppercase">Libreta de Fiados (Cuentas por Cobrar)</h3>
          <p className="text-xs text-slate-500">Total por cobrar: <strong className="text-red-600">{formatSoles(grandTotal)}</strong> · {debtors.length} clientes</p>
        </div>
        <div className="flex gap-2">
          <input type="text" placeholder="Buscar cliente o DNI/RUC" value={search} onChange={e => setSearch(e.target.value)}
            className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm" />
          <button type="button" onClick={() => void loadDebtors()} className="p-2 bg-white border border-slate-300 rounded-xl" title="Actualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      {message?.error && <p className="text-sm text-red-600">{message.text}</p>}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {!loading && filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-300 mb-2" />
            <p className="font-bold text-sm">No hay cuentas por cobrar</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(d => (
              <button key={d.id} type="button" onClick={() => void openStatement(d.id)}
                className="w-full p-4 flex justify-between items-center hover:bg-slate-50 text-left">
                <div>
                  <div className="font-bold text-slate-900">{d.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {d.docNumber ?? 'Sin documento'}{d.route ? ` · ${d.route}` : ''} · {d.openOrders} boleta(s) · desde {new Date(d.oldestDebtAt).toLocaleDateString('es-PE')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-black text-red-600">{formatSoles(d.fiadoDebt)}</div>
                  <div className="text-[10px] text-emerald-700 font-bold">Ver / Abonar ➔</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
