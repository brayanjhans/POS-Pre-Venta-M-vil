import React from 'react';
import { X } from 'lucide-react';
import { parseAmount } from '../../domain/money';
import { usePos } from '../../state/PosContext';
import { isValidPhone } from '../../domain/customer';
import type { Customer, DocType } from '../../types/pos';

interface Props {
  customer?: Customer | null;
  onClose: () => void;
  onSaved: (customer: Customer) => void;
}

/** Alta/edición de cliente. Vendedores y cajeros pueden crear; solo el admin edita y fija límites. */
export const CustomerForm: React.FC<Props> = ({ customer, onClose, onSaved }) => {
  const { api, session, refreshCatalog, handleError } = usePos();
  const isAdmin = session?.user.role === 'admin';
  const [name, setName] = React.useState(customer?.name ?? '');
  const [docType, setDocType] = React.useState<DocType>(customer?.docType ?? 'DNI');
  const [docNumber, setDocNumber] = React.useState(customer?.docNumber ?? '');
  const [route, setRoute] = React.useState(customer?.route ?? '');
  const [phone, setPhone] = React.useState(customer?.phone ?? '');
  const [address, setAddress] = React.useState(customer?.address ?? '');
  const [limit, setLimit] = React.useState(customer?.customCreditLimit != null ? String(customer.customCreditLimit) : '');
  const [isActive, setIsActive] = React.useState(customer?.isActive ?? true);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!api) return;
    const phoneDigits = phone.replace(/\D/g, '');
    if (!isValidPhone(phoneDigits)) {
      setError('Ingrese un celular válido: 9 dígitos que empiecen con 9.');
      return;
    }
    const customLimit = limit.trim() ? parseAmount(limit) : null;
    if (customLimit !== null && Number.isNaN(customLimit)) {
      setError('Límite de crédito inválido.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = await api.saveCustomer({
        id: customer?.id,
        name: name.trim(),
        docType,
        docNumber: docType === 'NINGUNO' ? null : docNumber.trim(),
        route: route.trim() || null,
        phone: phoneDigits,
        address: address.trim() || null,
        customCreditLimit: customLimit,
        isActive,
      });
      await refreshCatalog();
      onSaved(saved);
    } catch (err) {
      setError(handleError(err));
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full bg-white border border-slate-300 rounded-lg p-2 text-sm text-slate-900 focus:outline-hidden focus:border-[#16a34a]';

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-3 text-slate-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-black uppercase text-sm">{customer ? 'Editar cliente' : 'Nuevo cliente'}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <input className={field} placeholder="Nombre o razón social *" value={name} onChange={e => setName(e.target.value)} required minLength={2} />
        <div className="grid grid-cols-3 gap-2">
          <select className={field} value={docType} onChange={e => setDocType(e.target.value as DocType)}>
            <option value="DNI">DNI</option>
            <option value="RUC">RUC</option>
            <option value="OTRO">Otro</option>
            <option value="NINGUNO">Sin doc.</option>
          </select>
          {docType !== 'NINGUNO' && (
            <input className={`${field} col-span-2`} placeholder="Número" inputMode="numeric" value={docNumber}
              onChange={e => setDocNumber(e.target.value.trim())} required />
          )}
        </div>
        <input className={field} placeholder="Ruta / zona (ej. Ruta 1 - Centro)" value={route} onChange={e => setRoute(e.target.value)} />
        <input className={field} placeholder="Celular * (ej. 987654321)" type="tel" inputMode="tel" autoComplete="tel"
          value={phone} onChange={e => setPhone(e.target.value.replace(/[^\d ]/g, '').slice(0, 11))} required />
        <input className={field} placeholder="Dirección" value={address} onChange={e => setAddress(e.target.value)} />
        {isAdmin && (
          <>
            <label className="block text-xs font-bold text-slate-500">
              Límite de crédito propio (vacío = límite general)
              <input className={`${field} mt-1`} inputMode="decimal" placeholder="Ej. 800" value={limit} onChange={e => setLimit(e.target.value)} />
            </label>
            {customer && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> Cliente activo
              </label>
            )}
          </>
        )}
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <button type="submit" disabled={saving} className="w-full py-3 bg-[#16a34a] text-white font-black rounded-xl disabled:opacity-50">
          {saving ? 'Guardando…' : 'GUARDAR CLIENTE'}
        </button>
      </form>
    </div>
  );
};
