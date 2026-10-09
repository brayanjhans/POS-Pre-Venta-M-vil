import React from 'react';
import { Phone, Plus, Users } from 'lucide-react';
import { formatSoles } from '../../domain/money';
import { formatPhone, missingContact } from '../../domain/customer';
import { usePos } from '../../state/PosContext';
import { ROTATION, TONE } from '../../app/tones';
import { Card, EmptyState, PageTitle, PillButton, Pills, SearchField, StatusPill } from '../../app/ui';
import { CustomerForm } from '../shared/CustomerForm';
import type { Customer } from '../../types/pos';

type Filter = 'todos' | 'deben' | 'completar';

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

/** Cartera de clientes: alta, edición, límite de crédito y deuda actual. */
export const CustomersTab: React.FC = () => {
  const { catalog } = usePos();
  const [editing, setEditing] = React.useState<Customer | 'new' | null>(null);
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState<Filter>('todos');
  const customers = catalog?.customers ?? [];
  const q = search.toLowerCase().trim();
  const bySearch = customers.filter(c => !q || c.name.toLowerCase().includes(q) || (c.docNumber ?? '').includes(q) || (c.route ?? '').toLowerCase().includes(q) || (c.phone ?? '').includes(q));
  const list = bySearch.filter(c => filter === 'todos' || (filter === 'deben' ? c.debt > 0 : missingContact(c)));
  const totalDebt = customers.reduce((a, c) => a + c.debt, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4 text-ink">
      <PageTitle
        title="Su cartera"
        subtitle={<>{customers.length} registrados{totalDebt > 0 && <>, deben <strong className="text-fresa">{formatSoles(totalDebt)}</strong></>}</>}
        action={<PillButton onClick={() => setEditing('new')}><Plus className="h-5 w-5" /> Nuevo</PillButton>}
      />
      <SearchField value={search} onChange={setSearch} placeholder="Nombre, celular, DNI/RUC o ruta" />
      <Pills<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'todos', label: 'Todos', count: bySearch.length },
          { value: 'deben', label: 'Con deuda', count: bySearch.filter(c => c.debt > 0).length },
          { value: 'completar', label: 'Completar datos', count: bySearch.filter(missingContact).length },
        ]}
      />
      <p className="text-sm text-ink-soft">Límite de crédito general: {formatSoles(Number(catalog?.settings.default_credit_limit ?? 500))}. Puede fijar uno propio por cliente.</p>

      {list.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} tone="sky" title="No hay clientes con este filtro"
          hint="Registre uno nuevo; basta con el nombre." action={<PillButton onClick={() => setEditing('new')}><Plus className="h-5 w-5" /> Nuevo cliente</PillButton>} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((c, i) => {
            const used = c.creditLimit > 0 ? Math.min(c.debt / c.creditLimit, 1) : 0;
            return (
              <li key={c.id}>
                <button type="button" onClick={() => setEditing(c)} className="squish h-full w-full text-left">
                  <Card className={`h-full ${c.isActive ? '' : 'opacity-60'}`}>
                    <div className="flex items-start gap-3">
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold text-ink ${TONE[ROTATION[i % ROTATION.length]].bg}`}>
                        {initials(c.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-display text-[17px] font-bold leading-tight">{c.name}</span>
                          {!c.isActive && <StatusPill tone="muted">Inactivo</StatusPill>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
                          {missingContact(c)
                            ? <StatusPill tone="sun">Completar datos</StatusPill>
                            : <span className="inline-flex items-center gap-1 font-bold text-ink"><Phone className="h-3.5 w-3.5" />{formatPhone(c.phone)}</span>}
                          {c.docType !== 'NINGUNO' && <span>{c.docType} {c.docNumber}</span>}
                          {c.route && <span>{c.route}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="text-ink-soft">Debe</span>
                        <span className={`font-display text-lg font-bold ${c.debt > 0 ? 'text-fresa' : 'text-ink/40'}`}>{formatSoles(c.debt)}</span>
                      </div>
                      {/* Cuánto del crédito ya usó: el carril es un tono claro del mismo color */}
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-pink/30" role="img" aria-label={`Usó ${Math.round(used * 100)}% de su crédito`}>
                        <div className={`h-full rounded-full ${used >= 0.8 ? 'bg-fresa' : 'bg-pink-strong'}`} style={{ width: `${used * 100}%` }} />
                      </div>
                      <div className="mt-1 text-right text-xs text-ink-soft">de {formatSoles(c.creditLimit)}{c.customCreditLimit != null && ' (límite propio)'}</div>
                    </div>
                  </Card>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <CustomerForm customer={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => setEditing(null)} />
      )}
    </div>
  );
};
