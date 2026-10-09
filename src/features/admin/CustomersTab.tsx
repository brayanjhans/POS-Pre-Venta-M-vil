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
          <h3 className="text-lg font-black text-slate-900 uppercase">Clientes</h3>
          <p className="text-xs text-slate-500">
            Límite de crédito por defecto: {formatSoles(Number(catalog?.settings.default_credit_limit ?? 500))}. Puede fijar uno propio por cliente.
          </p>
        </div>
        <div className="flex gap-2">
          <input type="text" placeholder="Nombre, DNI/RUC o ruta" value={search} onChange={e => setSearch(e.target.value)}
            className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm" />
          <button type="button" onClick={() => setEditing('new')}
            className="px-4 py-2 bg-[#16a34a] text-white font-black text-xs uppercase rounded-xl flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="p-3">Cliente</th>
              <th className="p-3">Celular</th>
              <th className="p-3">Documento</th>
              <th className="p-3">Ruta</th>
              <th className="p-3 text-right">Deuda</th>
              <th className="p-3 text-right">Límite</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map(c => (
              <tr key={c.id} className={c.isActive ? '' : 'opacity-50'}>
                <td className="p-3 font-bold">{c.name}{!c.isActive && <span className="ml-1 text-xs bg-slate-200 px-1 rounded">INACTIVO</span>}</td>
                <td className="p-3 text-xs">
                  {missingContact(c) ? (
                    <button type="button" onClick={() => setEditing(c)}
                      className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-bold text-amber-800">
                      Completar datos
                    </button>
                  ) : <span className="font-mono">{formatPhone(c.phone)}</span>}
                </td>
                <td className="p-3 font-mono text-xs">{c.docType !== 'NINGUNO' ? `${c.docType} ${c.docNumber}` : '—'}</td>
                <td className="p-3 text-xs">{c.route ?? '—'}</td>
                <td className={`p-3 text-right font-mono font-bold ${c.debt > 0 ? 'text-red-600' : 'text-slate-400'}`}>{formatSoles(c.debt)}</td>
                <td className="p-3 text-right font-mono text-xs">{formatSoles(c.creditLimit)}{c.customCreditLimit != null && ' *'}</td>
                <td className="p-3 text-right">
                  <button type="button" onClick={() => setEditing(c)} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg" title="Editar">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">Sin clientes.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <CustomerForm customer={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => setEditing(null)} />
      )}
    </div>
  );
};
