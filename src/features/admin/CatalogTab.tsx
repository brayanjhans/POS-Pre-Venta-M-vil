import React from 'react';
import { EyeOff, MoreHorizontal, PackagePlus, Pencil, Plus, Search, Trash2, Eye } from 'lucide-react';
import { useDialog } from '../../app/DialogProvider';
import { formatSoles } from '../../domain/money';
import type { PresentationType, Product } from '../../types/pos';
import { ProductArt, resolveArt } from '../../app/ProductArt';
import { categoryArtOf, useCategories } from '../../app/categories';
import { TONE, categoryTone } from '../../app/tones';
import { ProductForm } from './ProductForm';

interface Props {
  products: Product[];
  onSave: (product: Partial<Product>) => Promise<boolean>;
  onDelete: (product: Product) => Promise<unknown>;
  onToggleActive: (product: Product) => Promise<unknown>;
  onRestock: (product: Product) => void;
  /** Abre directamente el formulario de producto nuevo. */
  startCreating?: boolean;
  onCreatingDone?: () => void;
}

const daysUntil = (date: string) => Math.ceil((new Date(`${date}T12:00:00`).getTime() - Date.now()) / 86_400_000);
const PRES_NAME: Record<PresentationType, string> = { unit: 'Unidad', quarter: 'Cuarto', half: 'Medio', pack: 'Paquete' };
const ORDER: PresentationType[] = ['unit', 'quarter', 'half', 'pack'];

/** Catálogo del admin: buscar, filtrar, crear, editar, reponer, ocultar y eliminar productos. */
export const CatalogTab: React.FC<Props> = ({ products, onSave, onDelete, onToggleActive, onRestock, startCreating, onCreatingDone }) => {
  const dialog = useDialog();
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState<string>('Todos');
  const categoryInfo = useCategories();
  const [editing, setEditing] = React.useState<Product | 'new' | null>(startCreating ? 'new' : null);
  const [menuFor, setMenuFor] = React.useState<string | null>(null);

  React.useEffect(() => { if (startCreating) setEditing('new'); }, [startCreating]);

  const q = query.toLowerCase().trim();
  const list = products
    .filter(p => category === 'Todos' || p.category === category)
    .filter(p => !q || p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.category.toLowerCase().includes(q))
    .sort((a, b) => Number(a.isActive === false) - Number(b.isActive === false) || a.name.localeCompare(b.name));
  const barcodes = React.useMemo(() => new Map(products.map(p => [p.barcode, p.id])), [products]);
  const hidden = products.filter(p => p.isActive === false).length;

  const closeForm = () => {
    setEditing(null);
    onCreatingDone?.();
  };

  const remove = async (p: Product) => {
    setMenuFor(null);
    if (await dialog.confirm(`Si ya tiene ventas, se ocultará en lugar de borrarse para conservar el historial.`,
      { title: `¿Eliminar ${p.name}?`, tone: 'danger', confirmText: 'Eliminar' })) {
      await onDelete(p);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 text-ink">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre o código"
            className="h-12 w-full rounded-xl border border-ink/15 bg-white pl-10 pr-3 text-[15px] outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15" />
        </div>
        <button type="button" onClick={() => setEditing('new')}
          className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-[15px] font-bold text-white active:scale-95">
          <Plus className="h-5 w-5" /> <span className="hidden sm:inline">Nuevo producto</span><span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {['Todos', ...categoryInfo.filter(c => products.some(p => p.category === c.name)).map(c => c.name)].map(c => (
          <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={category === c}
            className={`h-10 shrink-0 rounded-xl px-3.5 text-sm font-bold transition ${category === c ? 'bg-ink text-white' : 'border border-ink/15 bg-white text-ink'}`}>
            {c}
          </button>
        ))}
      </div>

      <p className="text-sm text-ink-soft">
        {list.length === 1 ? '1 producto' : `${list.length} productos`}{hidden > 0 && category === 'Todos' && !q ? `, ${hidden} ocultos en la venta` : ''}
      </p>

      {list.length === 0 && (
        <div className="rounded-2xl border border-dashed border-ink/20 p-6 text-center">
          <p className="font-bold">No hay productos que coincidan.</p>
          <button type="button" onClick={() => setEditing('new')} className="mt-3 inline-flex h-11 items-center gap-1.5 rounded-xl bg-ink px-4 font-bold text-white">
            <Plus className="h-5 w-5" /> Agregar un producto
          </button>
        </div>
      )}

      <ul className="space-y-3">
        {list.map(p => {
          const low = p.stockInBaseUnits <= p.minStockAlert;
          const exp = p.expirationDate ? daysUntil(p.expirationDate) : null;
          const off = p.isActive === false;
          return (
            <li key={p.id} className={`rounded-2xl border border-ink/10 bg-white p-4 ${off ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3">
                <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${TONE[categoryTone(p.category)].soft}`} aria-hidden>
                  <ProductArt art={resolveArt(p, categoryArtOf(categoryInfo, p.category))} color={p.accentColor} className="h-11 w-11" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="font-display text-[17px] font-bold leading-tight">{p.name}</h3>
                    {off && <span className="rounded-md bg-ink/10 px-1.5 text-sm font-bold text-ink-soft">Oculto</span>}
                    {p.isPromo && !off && <span className="rounded-md bg-tag px-1.5 text-sm font-bold">Oferta</span>}
                  </div>
                  <div className="mt-0.5 text-sm text-ink-soft">{p.category}{p.flavorNote ? `, ${p.flavorNote}` : ''}</div>
                  <div className="font-display text-sm text-ink-soft">{p.barcode}</div>
                </div>
                <div className="relative shrink-0">
                  <button type="button" onClick={() => setMenuFor(menuFor === p.id ? null : p.id)} aria-label="Más opciones"
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft hover:bg-ink/5">
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                  {menuFor === p.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                      <div className="absolute right-0 top-11 z-20 w-52 overflow-hidden rounded-xl border border-ink/10 bg-white py-1 shadow-xl">
                        <button type="button" onClick={() => { setMenuFor(null); void onToggleActive(p); }}
                          className="flex h-11 w-full items-center gap-2.5 px-3 text-left text-[15px] font-bold hover:bg-ink/5">
                          {off ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} {off ? 'Mostrar en la venta' : 'Ocultar en la venta'}
                        </button>
                        <button type="button" onClick={() => void remove(p)}
                          className="flex h-11 w-full items-center gap-2.5 px-3 text-left text-[15px] font-bold text-fresa hover:bg-fresa/5">
                          <Trash2 className="h-4 w-4" /> Eliminar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Precios por presentación */}
              <div className="mt-3 flex flex-wrap gap-2">
                {ORDER.map(t => {
                  const pres = p.presentations[t];
                  if (!pres) return null;
                  return (
                    <div key={t} className="rounded-xl bg-paper px-2.5 py-1.5">
                      <div className="text-xs text-ink-soft">{PRES_NAME[t]}{pres.conversionFactor > 1 ? ` ×${pres.conversionFactor}` : ''}</div>
                      <div className="font-display text-[15px] font-bold">{formatSoles(pres.price)}</div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3">
                <div className="text-sm">
                  <span className={`font-display text-base font-bold ${p.stockInBaseUnits < 0 ? 'text-fresa' : low ? 'text-amber-700' : ''}`}>
                    {p.stockInBaseUnits}
                  </span>{' '}
                  <span className="text-ink-soft">{p.baseUnitName}s{low ? ', por reponer' : ''}</span>
                  {exp !== null && exp <= 30 && (
                    <span className={`ml-2 rounded-md px-1.5 font-bold ${exp < 0 ? 'bg-fresa text-white' : exp <= 7 ? 'bg-tag' : 'bg-ink/5 text-ink-soft'}`}>
                      {exp < 0 ? 'Vencido' : exp === 0 ? 'Vence hoy' : `Vence en ${exp} d`}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => onRestock(p)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-ink/15 px-3 text-sm font-bold active:scale-95">
                    <PackagePlus className="h-4 w-4" /> Reponer
                  </button>
                  <button type="button" onClick={() => setEditing(p)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-50 px-3 text-sm font-bold text-brand-800 active:scale-95">
                    <Pencil className="h-4 w-4" /> Editar
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {editing && (
        <ProductForm product={editing === 'new' ? null : editing} existingBarcodes={barcodes} onSave={onSave} onClose={closeForm} />
      )}
    </div>
  );
};
