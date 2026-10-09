import React from 'react';
import { parseAmount } from '../../domain/money';
import { usePos } from '../../state/PosContext';

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

  const field = 'w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm mt-1';
  const label = 'block text-xs font-bold text-ink-soft ';

  return (
    <form onSubmit={submit} className="space-y-4 max-w-xl mx-auto bg-white p-6 rounded-3xl border border-slate-200 animate-in fade-in">
      <h3 className="text-lg font-black ">Configuración</h3>
      <label className={label}>Nombre de la tienda (sale en el ticket)
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
      <div className="grid grid-cols-3 gap-3">
        <label className={label}>Límite de fiado (S/)
          <input className={field} inputMode="decimal" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} />
        </label>
        <label className={label}>Descuento máx. (%)
          <input className={field} inputMode="decimal" value={maxDiscount} onChange={e => setMaxDiscount(e.target.value)} />
        </label>
        <label className={label}>Duración sesión (h)
          <input className={field} inputMode="numeric" value={sessionHours} onChange={e => setSessionHours(e.target.value)} />
        </label>
      </div>
      <p className="text-xs text-ink-soft">
        El límite de fiado aplica a clientes sin límite propio y lo valida el servidor en cada venta a crédito y en cada fiado en caja.
      </p>
      {message && <p className={`text-sm ${message.error ? 'text-red-600' : 'text-brand-700'}`}>{message.text}</p>}
      <button type="submit" disabled={saving} className="w-full py-3 bg-brand-600 text-white font-black rounded-xl disabled:opacity-50">
        {saving ? 'Guardando…' : 'Guardar configuración'}
      </button>
    </form>
  );
};
