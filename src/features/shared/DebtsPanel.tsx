import React from 'react';
import { ArrowLeft, CheckCircle2, HandCoins, History, Phone, Receipt, RefreshCw } from 'lucide-react';
import { formatPhone } from '../../domain/customer';
import { formatSoles, parseAmount, round2 } from '../../domain/money';
import { usePos } from '../../state/PosContext';
import { OrderReceiptModal } from './OrderReceiptModal';
import { Card, EmptyState, IconBubble, Pills, SearchField, StatusPill } from '../../app/ui';
import {
  PAYMENT_METHODS, type CustomerStatement, type DebtorSummary, type Order, type PaidFiado, type PaymentMethod,
} from '../../types/pos';

const KIND_LABEL = { VENTA: 'Pago en venta', ABONO: 'Abono', DEVOLUCION: 'Devolución' } as const;

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es-PE');

/** Celular clicable (abre la app de llamadas del celular). */
const PhoneLink: React.FC<{ phone?: string | null }> = ({ phone }) =>
  phone ? (
    <a href={`tel:${phone}`} onClick={e => e.stopPropagation()}
      className="inline-flex items-center gap-0.5 text-brand-700 font-bold hover:underline">
      <Phone className="w-3 h-3" />{formatPhone(phone)}
    </a>
  ) : (
    <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 font-bold text-amber-800">Completar datos</span>
  );

/**
 * Libreta de fiados: clientes con deuda, su estado de cuenta (boletas + historial de pagos),
 * registro de abonos (totales o parciales, por boleta) e historial de fiados ya pagados.
 * Lo usan el admin y la caja.
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
  const [tab, setTab] = React.useState<'pendientes' | 'pagados'>('pendientes');
  const [paid, setPaid] = React.useState<PaidFiado[]>([]);
  const [paidLoading, setPaidLoading] = React.useState(false);
  const abonoFormRef = React.useRef<HTMLFormElement>(null);
  const amountInputRef = React.useRef<HTMLInputElement>(null);

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

  const loadPaid = React.useCallback(async () => {
    if (!api) return;
    setPaidLoading(true);
    try {
      setPaid(await api.paidFiados());
    } catch (e) {
      setMessage({ text: handleError(e), error: true });
    } finally {
      setPaidLoading(false);
    }
  }, [api, handleError]);

  React.useEffect(() => { if (tab === 'pagados') void loadPaid(); }, [tab, loadPaid]);

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

  /** Botón "Abonar" de una boleta: el abono se aplica solo a esa boleta. */
  const startAbonoFor = (order: Order) => {
    setTargetOrderId(order.id);
    setAmount('');
    setMessage(null);
    abonoFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => amountInputRef.current?.focus(), 300);
  };

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
      if (result.applied.some(a => a.remaining === 0)) void loadPaid();
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
      <div className="mx-auto max-w-3xl space-y-4 text-ink">
        <button type="button" onClick={() => { setStatement(null); setMessage(null); }}
          className="-ml-1 inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-[15px] font-bold text-ink-soft hover:text-ink">
          <ArrowLeft className="h-5 w-5" /> Volver
        </button>

        {/* Cliente y su deuda */}
        <div className="rounded-3xl bg-pink/45 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/80 font-display text-xl font-bold">
              {c.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')}
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-2xl font-bold leading-tight">{c.name}</h3>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[15px] text-ink/75">
                <PhoneLink phone={c.phone} />
                {c.docType !== 'NINGUNO' && <span>{c.docType} {c.docNumber}</span>}
                {c.route && <span>{c.route}</span>}
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <div className="text-[15px] font-bold text-ink/75">Debe</div>
              <div className="font-display text-[40px] font-bold leading-none">{formatSoles(totalDebt)}</div>
            </div>
            <div className="text-right text-sm text-ink/75">Límite<br /><strong className="font-display text-base text-ink">{formatSoles(c.creditLimit)}</strong></div>
          </div>
        </div>

        {message && (
          <div className={`rounded-2xl px-4 py-3 text-[15px] font-bold ${message.error ? 'bg-fresa/10 text-fresa' : 'bg-mint/50 text-ink'}`}>
            {message.text}
          </div>
        )}

        {totalDebt > 0 && (
          <form ref={abonoFormRef} onSubmit={submitAbono} className="space-y-4 rounded-3xl bg-white p-5">
            <div className="flex items-center gap-3">
              <IconBubble tone="mint" size="sm"><HandCoins className="h-5 w-5" /></IconBubble>
              <div>
                <h4 className="font-display text-xl font-bold leading-tight">Registrar abono</h4>
                <p className="text-sm text-ink-soft">
                  Una parte o el total. Debe {targetOrderId ? `en ${openOrders.find(o => o.id === targetOrderId)?.code ?? ''}` : 'en total'}{' '}
                  <strong className="font-display text-ink">{formatSoles(maxForTarget)}</strong>
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display font-bold text-ink-soft">S/</span>
                <input ref={amountInputRef} type="text" inputMode="decimal" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required
                  aria-label="Monto del abono"
                  className="h-14 w-full rounded-2xl border-2 border-ink/10 bg-white pl-11 pr-3 font-display text-2xl font-bold outline-none focus:border-brand-600" />
              </div>
              <button type="button" onClick={() => setAmount(maxForTarget.toFixed(2))} className="squish h-14 shrink-0 rounded-2xl bg-cream px-4 text-[15px] font-bold">
                Todo
              </button>
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-bold">Cómo paga</span>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button key={m} type="button" onClick={() => setMethod(m)} aria-pressed={method === m}
                    className={`squish h-10 rounded-full px-4 text-[15px] font-bold transition ${method === m ? 'bg-ink text-white' : 'border border-ink/15 bg-white'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold">Aplicar a</span>
              <select value={targetOrderId} onChange={e => setTargetOrderId(e.target.value)}
                className="h-12 w-full rounded-2xl border-2 border-ink/10 bg-white px-3 text-[15px] outline-none focus:border-brand-600">
                <option value="">La deuda más antigua primero</option>
                {openOrders.map(o => <option key={o.id} value={o.id}>Solo {o.code} (debe {formatSoles(o.debtAmount)})</option>)}
              </select>
            </label>
            <input type="text" placeholder="Nota (opcional)" value={notes} onChange={e => setNotes(e.target.value)}
              className="h-12 w-full rounded-2xl border-2 border-ink/10 bg-white px-3 text-[15px] outline-none focus:border-brand-600" />
            <button type="submit" disabled={saving} className="squish h-14 w-full rounded-full bg-ink text-base font-bold text-white disabled:opacity-50">
              {saving ? 'Guardando…' : 'Registrar abono'}
            </button>
          </form>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-3xl bg-white p-5">
            <h4 className="mb-3 font-display text-xl font-bold">Boletas</h4>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {statement.orders.length === 0 && <p className="text-xs text-ink/45">Sin boletas a crédito.</p>}
              {statement.orders.map(o => {
                const canAbonar = o.status === 'FIADO' && (o.debtAmount ?? 0) > 0;
                const abonado = round2(o.totalAmount - (o.debtAmount ?? 0));
                return (
                  <div key={o.id} className={`flex items-stretch gap-2 rounded-xl border text-xs ${targetOrderId === o.id ? 'border-brand-500 bg-brand-50/50' : 'border-ink/5'}`}>
                    <button type="button" onClick={() => setViewOrder(o)}
                      className="flex-1 flex justify-between items-center p-2.5 rounded-xl hover:bg-cream/60 text-left min-w-0">
                      <div className="min-w-0">
                        <div className="font-bold">
                          Boleta <span className="font-display">{o.code}</span>
                          <span className={`ml-1 px-1.5 rounded text-xs ${o.status === 'FIADO' ? 'bg-orange-100 text-orange-800' : o.status === 'PAGADO' ? 'bg-brand-100 text-brand-800' : 'bg-amber-100 text-amber-800'}`}>{o.status}</span>
                        </div>
                        <div className="text-xs text-ink-soft">
                          {formatDate(o.createdAt)} · total {formatSoles(o.totalAmount)}{canAbonar && abonado > 0 ? ` · abonado ${formatSoles(abonado)}` : ''}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-soft line-clamp-1">
                          {o.items.map(i => `${i.productName} ×${i.quantity}`).join(', ')}
                        </div>
                        <div className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-brand-700">
                          <Receipt className="w-3.5 h-3.5" /> Ver boleta ›
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-ink-soft">debe</div>
                        <div className={`font-display font-black ${(o.debtAmount ?? 0) > 0 ? 'text-red-600' : 'text-brand-700'}`}>{formatSoles(o.debtAmount)}</div>
                      </div>
                    </button>
                    {canAbonar && (
                      <button type="button" onClick={() => startAbonoFor(o)}
                        className="px-3 my-1.5 mr-1.5 rounded-lg bg-brand-600 text-white font-black text-xs  flex items-center gap-1 shrink-0">
                        <HandCoins className="w-3.5 h-3.5" /> Abonar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-3xl bg-white p-5">
            <h4 className="mb-3 font-display text-xl font-bold">Pagos y abonos</h4>
            <div className="space-y-1.5 max-h-80 overflow-y-auto text-xs">
              {statement.payments.length === 0 && <p className="text-ink/45">Sin pagos registrados.</p>}
              {statement.payments.map(p => (
                <div key={p.id} className="flex justify-between border-b border-ink/5 py-1.5">
                  <div>
                    <div className="font-bold">{KIND_LABEL[p.kind]} · {p.method}</div>
                    <div className="text-xs text-ink-soft">
                      {new Date(p.createdAt).toLocaleString('es-PE')} · {p.orderCode} · {p.receivedBy}{p.notes ? ` · ${p.notes}` : ''}
                    </div>
                  </div>
                  <div className={`font-display font-black ${p.amount < 0 ? 'text-red-600' : 'text-brand-700'}`}>{formatSoles(p.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {viewOrder && (
          <OrderReceiptModal order={viewOrder} onClose={() => setViewOrder(null)}
            payments={statement.payments.filter(p => p.orderId === viewOrder.id)} />
        )}
      </div>
    );
  }

  const q = search.toLowerCase().trim();
  const digits = q.replace(/\D/g, '');
  const filtered = debtors.filter(d => !q || d.name.toLowerCase().includes(q) || (d.docNumber ?? '').includes(q)
    || (!!digits && (d.phone ?? '').includes(digits)) || (d.orderCodes ?? []).some(code => code.toLowerCase().includes(q)));
  const filteredPaid = paid.filter(o => !q || (o.customerName ?? '').toLowerCase().includes(q) || o.code.toLowerCase().includes(q)
    || (o.customerDoc ?? '').includes(q) || (!!digits && (o.customerPhone ?? '').includes(digits)));
  const grandTotal = debtors.reduce((acc, d) => acc + d.fiadoDebt, 0);
  const paidTotal = filteredPaid.reduce((acc, o) => acc + o.totalAmount, 0);
  const isLoading = tab === 'pendientes' ? loading : paidLoading;

  const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

  return (
    <div className="mx-auto max-w-3xl space-y-4 text-ink">
      {/* Cifra protagonista: lo que falta cobrar */}
      <div className="rounded-3xl bg-pink/45 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[15px] font-bold text-ink/75">{tab === 'pendientes' ? 'Por cobrar' : 'Fiados ya pagados'}</p>
            <p className="font-display text-[44px] font-bold leading-none">{formatSoles(tab === 'pendientes' ? grandTotal : paidTotal)}</p>
            <p className="mt-1.5 text-[15px] text-ink/75">
              {tab === 'pendientes'
                ? (debtors.length === 1 ? '1 cliente debe' : `${debtors.length} clientes deben`)
                : (filteredPaid.length === 1 ? '1 boleta pagada' : `${filteredPaid.length} boletas pagadas`)}
            </p>
          </div>
          <button type="button" onClick={() => void (tab === 'pendientes' ? loadDebtors() : loadPaid())} aria-label="Actualizar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/70 text-ink">
            <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <Pills<'pendientes' | 'pagados'>
        value={tab}
        onChange={key => { setTab(key); setMessage(null); }}
        options={[
          { value: 'pendientes', label: <><HandCoins className="h-4 w-4" /> Pendientes</> },
          { value: 'pagados', label: <><History className="h-4 w-4" /> Pagados</> },
        ]}
      />
      <SearchField value={search} onChange={setSearch} placeholder="Cliente, celular, DNI/RUC o boleta" />

      {message?.error && <p className="text-[15px] font-bold text-fresa">{message.text}</p>}

      {tab === 'pendientes' ? (
        !loading && filtered.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} tone="mint" title="Nadie debe nada" hint="Cuando alguien compre al fiado, aparecerá aquí." />
        ) : (
          <ul className="space-y-2.5">
            {filtered.map(d => (
              <li key={d.id}>
                <button type="button" onClick={() => void openStatement(d.id)} className="squish w-full text-left">
                  <Card className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pink font-display text-lg font-bold">{initials(d.name)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[17px] font-bold leading-tight">{d.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
                        <PhoneLink phone={d.phone} />
                        <span>Desde el {formatDate(d.oldestDebtAt)}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {(d.orderCodes ?? []).slice(0, 4).map(code => <StatusPill key={code} tone="cream">{code}</StatusPill>)}
                        {(d.orderCodes ?? []).length > 4 && <StatusPill tone="muted">+{(d.orderCodes ?? []).length - 4}</StatusPill>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-display text-lg font-bold text-fresa">{formatSoles(d.fiadoDebt)}</div>
                      <div className="text-sm font-bold text-brand-700">Abonar ›</div>
                    </div>
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        !paidLoading && filteredPaid.length === 0 ? (
          <EmptyState icon={<History className="h-6 w-6" />} tone="lilac" title="Aún no hay fiados pagados" hint="Cuando un cliente termine de pagar una boleta, quedará en este historial." />
        ) : (
          <ul className="space-y-2.5">
            {filteredPaid.map(o => (
              <li key={o.id}>
                <button type="button" onClick={() => setViewOrder(o)} className="squish w-full text-left">
                  <Card className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mint"><CheckCircle2 className="h-6 w-6" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-[17px] font-bold">{o.code}</span>
                        <StatusPill tone="mint">Pagado</StatusPill>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-ink-soft">
                        <span className="font-bold text-ink">{o.customerName ?? 'Cliente'}</span>
                        <PhoneLink phone={o.customerPhone} />
                      </div>
                      <div className="text-sm text-ink-soft">
                        Fiado el {formatDate(o.createdAt)}, pagado el {formatDate(o.lastAbonoAt)} en {o.abonosCount === 1 ? '1 abono' : `${o.abonosCount} abonos`}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-display text-lg font-bold">{formatSoles(o.totalAmount)}</div>
                      <div className="text-sm font-bold text-brand-700">Ver boleta ›</div>
                    </div>
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {viewOrder && <OrderReceiptModal order={viewOrder} onClose={() => setViewOrder(null)} />}
    </div>
  );
};
