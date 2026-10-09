import React from 'react';
import { parseAmount } from '../../domain/money';
import { usePos } from '../../state/PosContext';
import { HandCoins, ShieldCheck, Store } from 'lucide-react';
import { IconBubble, PageTitle } from '../../app/ui';

/** Datos de la tienda (salen en los tickets) y reglas generales de crédito y descuento. */
export const SettingsTab: React.FC = () => {
  const { api, catalog, refreshCatalog, handleError } = usePos();
  const s = catalog?.settings ?? {};
  const [storeName, setStoreName] = React.useState(s.store_name ?? '');
  const [storeRuc, setStoreRuc] = React.useState(s.store_ruc ?? '');
  const [storeAddress, setStoreAddress] = React.useState(s.store_address ?? '');
  const [creditLimit, setCreditLimit] = React.useState(String(s.default_credit_limit ?? 500));
  const [maxDiscount, setMaxDiscount] = React.useState(String(s.max_discount_percent ?? 10));
  const [sessionHours, setSessionHours] = React.useState(String(s.session_hours ?? 12));
  const [message, setMessage] = React.useState<{ text: string; error?: boolean } | null>(null);
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!api) return;
    const limit = parseAmount(creditLimit);
    const discount = parseAmount(maxDiscount);
    const hours = parseInt(sessionHours, 10);
    if (Number.isNaN(limit) || Number.isNaN(discount) || discount > 100 || !(hours >= 1 && hours <= 72)) {
      setMessage({ text: 'Revise los valores: límite y descuento numéricos (descuento ≤ 100) y sesión entre 1 y 72 horas.', error: true });
      return;
    }
    if (storeRuc && !/^\d{11}$/.test(storeRuc)) {
      setMessage({ text: 'El RUC debe tener 11 dígitos.', error: true });
      return;
    }
    setSaving(true);
    try {
      await api.saveSettings({
        store_name: storeName.trim(), store_ruc: storeRuc.trim(), store_address: storeAddress.trim(),
        default_credit_limit: limit, max_discount_percent: discount, session_hours: hours,
      });
      await refreshCatalog();
      setMessage({ text: '✓ Configuración guardada.' });
    } catch (err) {
      setMessage({ text: handleError(err), error: true });
    } finally {
      setSaving(false);
    }
  };

  const field = 'mt-1.5 h-12 w-full rounded-2xl border-2 border-ink/10 bg-white px-3 text-[15px] text-ink outline-none focus:border-brand-600';
  const label = 'block text-sm font-bold text-ink';
  const block = (tone: 'sun' | 'pink' | 'mint', icon: React.ReactNode, title: string, hint: string, children: React.ReactNode) => (
    <section className="rounded-3xl bg-white p-5">
      <div className="mb-4 flex items-center gap-3">
        <IconBubble tone={tone} size="sm">{icon}</IconBubble>
        <div>
          <h3 className="font-display text-xl font-bold leading-tight">{title}</h3>
          <p className="text-sm text-ink-soft">{hint}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-4 text-ink">
      <PageTitle title="Ajustes de la tienda" subtitle="Datos del ticket y reglas de venta." />
      {block('sun', <Store className="h-5 w-5" />, 'Su tienda', 'Salen en el ticket y en los reportes.', <>
        <label className={label}>Nombre de la tienda
          <input className={field} value={storeName} onChange={e => setStoreName(e.target.value)} maxLength={60} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>RUC
            <input className={field} inputMode="numeric" value={storeRuc} onChange={e => setStoreRuc(e.target.value.replace(/\D/g, '').slice(0, 11))} />
          </label>
          <label className={label}>Dirección
            <input className={field} value={storeAddress} onChange={e => setStoreAddress(e.target.value)} maxLength={100} />
          </label>
        </div>
      </>)}
      {block('pink', <HandCoins className="h-5 w-5" />, 'Fiado y descuentos', 'El servidor los valida en cada venta.', <>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>Límite de fiado (S/)
            <input className={field} inputMode="decimal" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} />
          </label>
          <label className={label}>Descuento máximo (%)
            <input className={field} inputMode="decimal" value={maxDiscount} onChange={e => setMaxDiscount(e.target.value)} />
          </label>
        </div>
        <p className="text-sm text-ink-soft">El límite de fiado aplica a los clientes que no tienen uno propio.</p>
      </>)}
      {block('mint', <ShieldCheck className="h-5 w-5" />, 'Seguridad', 'Cuánto dura una sesión abierta en el celular.', <>
        <label className={label}>Duración de la sesión (horas)
          <input className={field} inputMode="numeric" value={sessionHours} onChange={e => setSessionHours(e.target.value)} />
        </label>
      </>)}
      {message && <p className={`text-[15px] font-bold ${message.error ? 'text-fresa' : 'text-brand-700'}`}>{message.text}</p>}
      <button type="submit" disabled={saving} className="squish h-14 w-full rounded-full bg-ink text-base font-bold text-white disabled:opacity-50">
        {saving ? 'Guardando…' : 'Guardar configuración'}
      </button>
    </form>
  );
};
