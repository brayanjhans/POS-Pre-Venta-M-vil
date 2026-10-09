import React from 'react';
import { Pencil, Plus } from 'lucide-react';
import { formatSoles } from '../../domain/money';
import { formatPhone, missingContact } from '../../domain/customer';
import { usePos } from '../../state/PosContext';
import { CustomerForm } from '../shared/CustomerForm';
import type { Customer } from '../../types/pos';

/** Cartera de clientes: alta, edición, límite de crédito y deuda actual. */
export const CustomersTab: React.FC = () => {
  const { catalog } = usePos();
  const [editing, setEditing] = React.useState<Customer | 'new' | null>(null);
  const [search, setSearch] = React.useState('');
  const customers = catalog?.customers ?? [];
  const q = search.toLowerCase().trim();
  const list = customers.filter(c => !q || c.name.toLowerCase().includes(q) || (c.docNumber ?? '').includes(q) || (c.route ?? '').toLowerCase().includes(q) || (c.phone ?? '').includes(q));

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-ink ">Clientes</h3>
          <p className="text-xs text-ink-soft">
            Límite de crédito por defecto: {formatSoles(Number(catalog?.settings.default_credit_limit ?? 500))}. Puede fijar uno propio por cliente.
          </p>
        </div>
        <div className="flex gap-2">
          <input type="text" placeholder="Nombre, DNI/RUC o ruta" value={search} onChange={e => setSearch(e.target.value)}
            className="bg-white border border-ink/15 rounded-xl px-3 py-2 text-sm" />
          <button type="button" onClick={() => setEditing('new')}
            className="px-4 py-2 bg-brand-600 text-white font-black text-xs  rounded-xl flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {list.map(c => (
          <button key={c.id} type="button" onClick={() => setEditing(c)}
            className={`rounded-2xl border border-ink/10 bg-white p-4 text-left shadow-sm transition hover:border-brand-400 active:scale-[0.99] ${c.isActive ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-black text-ink">
                  {c.name}{!c.isActive && <span className="ml-1 text-xs font-bold bg-ink/10 px-1 rounded">Inactivo</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
                  {missingContact(c) ? (
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-bold text-amber-800">Completar datos</span>
                  ) : <span className="font-display font-bold text-ink">☎ {formatPhone(c.phone)}</span>}
                  {c.docType !== 'NINGUNO' && <span className="font-display">{c.docType} {c.docNumber}</span>}
                  {c.route && <span>· {c.route}</span>}
                </div>
              </div>
              <Pencil className="w-4 h-4 shrink-0 text-ink/45" />
            </div>
            <div className="mt-3 flex items-end justify-between border-t border-ink/5 pt-2.5 text-xs">
              <div>
                <div className="text-ink-soft">Debe</div>
                <div className={`font-display text-base font-black ${c.debt > 0 ? 'text-red-600' : 'text-ink/45'}`}>{formatSoles(c.debt)}</div>
              </div>
              <div className="text-right">
                <div className="text-ink-soft">Límite{c.customCreditLimit != null && ' propio'}</div>
                <div className="font-display font-bold text-ink">{formatSoles(c.creditLimit)}</div>
              </div>
            </div>
          </button>
        ))}
        {list.length === 0 && <p className="p-6 text-center text-ink/45 md:col-span-2">Sin clientes.</p>}
      </div>

      {editing && (
        <CustomerForm customer={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => setEditing(null)} />
      )}
    </div>
  );
};
