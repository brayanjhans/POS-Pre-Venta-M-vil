import React from 'react';
import { Loader2, Plus, Search, UserPlus, X } from 'lucide-react';
import { findSameName } from '../../domain/customer';
import { CustomerForm } from '../shared/CustomerForm';
import { usePos } from '../../state/PosContext';
import type { Customer } from '../../types/pos';

interface Props {
  customers: Customer[];
  selected: Customer | null;
  onSelect: (customer: Customer | null) => void;
  walkInName: string;
  onWalkInNameChange: (name: string) => void;
  /** Contado permite un cliente ocasional sin registrar. */
  allowWalkIn: boolean;
}

/** Selector de cliente con búsqueda por nombre, DNI/RUC o ruta, y alta rápida. */
export const CustomerPicker: React.FC<Props> = ({ customers, selected, onSelect, walkInName, onWalkInNameChange, allowWalkIn }) => {
  const { api, online, refreshCatalog, handleError } = usePos();
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [quickSaving, setQuickSaving] = React.useState(false);
  const [quickError, setQuickError] = React.useState('');

  // Alta rápida: crea el cliente solo con el nombre escrito en el buscador.
  const quickName = query.trim().replace(/\s+/g, ' ');
  const canQuickCreate = quickName.length >= 2 && findSameName(customers, quickName).length === 0;
  const quickCreate = async () => {
    if (!api || !canQuickCreate || quickSaving) return;
    setQuickSaving(true);
    setQuickError('');
    try {
      const saved = await api.saveCustomer({ name: quickName, docType: 'NINGUNO' });
      void refreshCatalog();
      onSelect(saved);
      setQuery('');
      setOpen(false);
    } catch (e) {
      setQuickError(handleError(e));
    } finally {
      setQuickSaving(false);
    }
  };

  const q = query.toLowerCase().trim();
  const matches = customers
    .filter(c => c.isActive && (!q || c.name.toLowerCase().includes(q) || (c.docNumber ?? '').includes(q) || (c.route ?? '').toLowerCase().includes(q)))
    .slice(0, 30);

  if (selected) {
    const nearLimit = selected.debt > 0 && selected.debt >= selected.creditLimit * 0.8;
    return (
      <div className="bg-white border border-brand-300 rounded-lg p-2 flex items-start justify-between gap-2">
        <div className="min-w-0 text-xs">
          <div className="font-black text-ink truncate">{selected.name}</div>
          <div className="text-xs text-ink-soft">
            {selected.docType !== 'NINGUNO' ? `${selected.docType}: ${selected.docNumber}` : 'Sin documento'}
          </div>
          {selected.debt > 0 && (
            <div className={`text-xs font-bold ${nearLimit ? 'text-red-600' : 'text-amber-700'}`}>
              Debe S/ {selected.debt.toFixed(2)} de S/ {selected.creditLimit.toFixed(2)} permitidos
            </div>
          )}
        </div>
        <button type="button" onClick={() => onSelect(null)} className="p-1 text-slate-400 hover:text-red-600" aria-label="Quitar cliente">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" />
        <input
          type="text"
          placeholder="Buscar o escribir el nombre del cliente…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          className="h-12 w-full rounded-full border border-ink/15 bg-white pl-11 pr-4 text-[15px] text-ink outline-none placeholder:text-ink/40 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15"
        />
        {open && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {matches.map(c => (
              <button key={c.id} type="button"
                onClick={() => { onSelect(c); setQuery(''); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-brand-50 border-b border-slate-100 last:border-0">
                <div className="font-bold text-ink">{c.name}</div>
                <div className="text-xs text-ink-soft">
                  {c.docNumber ?? 'Sin documento'}{c.route ? ` · ${c.route}` : ''}{c.debt > 0 ? ` · Debe S/ ${c.debt.toFixed(2)}` : ''}
                </div>
              </button>
            ))}
            {matches.length === 0 && !canQuickCreate && <div className="px-3 py-2 text-xs text-slate-400">Sin resultados</div>}
            {canQuickCreate && (
              <button type="button" onClick={() => void quickCreate()} disabled={!online || quickSaving}
                className="w-full text-left px-3 py-2.5 text-sm font-bold text-brand-800 bg-brand-50 hover:bg-brand-100 flex items-center gap-2 disabled:opacity-50">
                {quickSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span className="truncate">Crear cliente «{quickName}»</span>
                {!online && <span className="ml-auto text-xs font-medium text-ink-soft">requiere internet</span>}
              </button>
            )}
            {quickError && <div className="px-3 py-2 text-xs font-medium text-red-600">{quickError}</div>}
            <button type="button" onClick={() => setOpen(false)} className="w-full text-center text-xs text-slate-400 py-1.5">Cerrar</button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {allowWalkIn && (
          <input
            type="text"
            placeholder="O nombre sin registrar"
            value={walkInName}
            onChange={e => onWalkInNameChange(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-full border border-ink/15 bg-white px-4 text-[15px] text-ink outline-none placeholder:text-ink/40 focus:border-brand-600"
          />
        )}
        <button type="button" onClick={() => setCreating(true)} disabled={!online}
          title={online ? 'Registrar cliente nuevo' : 'Se necesita internet para registrar clientes'}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-bold text-white disabled:opacity-40">
          <UserPlus className="h-4 w-4" /> Nuevo
        </button>
      </div>

      {creating && (
        <CustomerForm
          onClose={() => setCreating(false)}
          onSaved={c => { onSelect(c); setCreating(false); }}
        />
      )}
    </div>
  );
};
