import React from 'react';
import { Camera, ImagePlus, Plus, Search, Trash2, X } from 'lucide-react';
import { CameraScanner } from '../shared/CameraScanner';
import { parseAmount, round2 } from '../../domain/money';
import type { PackagingType, PresentationType, Product, ProductCategory, ProductPresentation, ProductTemplate } from '../../types/pos';
import { usePos } from '../../state/PosContext';
import { useDialog } from '../../app/DialogProvider';
import { ProductArt, artSpot } from '../../app/ProductArt';
import { ProductThumb } from '../../app/ProductThumb';
import { compressProductPhoto, dataUrlBytes } from '../../lib/imageCompress';
import { photoId, rememberPhoto } from '../../lib/productImages';
import { useCategories } from '../../app/categories';

/*
 * Alta y edición de productos en un solo formulario, por secciones:
 * qué es el producto, cómo se vende (presentaciones con su precio), y stock.
 * Al editar, el stock no se toca aquí: se cambia con "Reponer", ventas o regularización.
 */

interface Props {
  product?: Product | null;
  /** Códigos ya usados, para avisar antes de guardar. */
  existingBarcodes: Map<string, string>;
  onSave: (product: Partial<Product>) => Promise<boolean>;
  onClose: () => void;
}

const PACKAGING: PackagingType[] = ['Botella Pet', 'Lata', 'Bolsa Sellada', 'Display Caja', 'Tira Colgante', 'Fardo Termocontraíble'];
/** Color por defecto de un producto nuevo según su categoría (si no viene de un producto conocido). */
const DEFAULT_COLOR = '#e5484d';

type Extra = Exclude<PresentationType, 'unit'>;
const EXTRA: { type: Extra; name: string; short: string }[] = [
  { type: 'quarter', name: 'Cuarto', short: 'CUA' },
  { type: 'half', name: 'Medio paquete', short: 'MED' },
  { type: 'pack', name: 'Paquete completo', short: 'PAQ' },
];

interface PresDraft { on: boolean; factor: string; price: string; cost: string }

const toText = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

export const ProductForm: React.FC<Props> = ({ product, existingBarcodes, onSave, onClose }) => {
  const editing = !!product?.id;
  const [name, setName] = React.useState(product?.name ?? '');
  const [barcode, setBarcode] = React.useState(product?.barcode ?? '');
  const [category, setCategory] = React.useState<ProductCategory>(product?.category ?? 'Golosinas');
  // Ilustración y color de marca (llegan de un producto conocido o se conservan al editar).
  const [art, setArt] = React.useState<string | null>(product?.imageUrl?.startsWith('art:') ? product.imageUrl.slice(4) : null);
  const [color, setColor] = React.useState<string>(product?.accentColor ?? DEFAULT_COLOR);
  // Foto: la nueva (ya reducida, aún sin subir) o si se quitó la que tenía.
  const [photo, setPhoto] = React.useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = React.useState(false);
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const hasSavedPhoto = !!photoId(product?.imageUrl) && !photoRemoved;
  const categories = useCategories();
  const { api, refreshCatalog, handleError } = usePos();
  const dialog = useDialog();
  const [tplQuery, setTplQuery] = React.useState('');
  const [tplResults, setTplResults] = React.useState<ProductTemplate[]>([]);
  const [tplLoading, setTplLoading] = React.useState(false);
  const [tplError, setTplError] = React.useState('');
  const [baseUnit, setBaseUnit] = React.useState(product?.baseUnitName ?? 'unidad');
  const [packaging, setPackaging] = React.useState<string>(product?.packagingType ?? 'Display Caja');
  const [note, setNote] = React.useState(product?.flavorNote ?? '');
  const [expiration, setExpiration] = React.useState(product?.expirationDate ?? '');
  const [isPromo, setIsPromo] = React.useState(product?.isPromo ?? false);
  const [unitPrice, setUnitPrice] = React.useState(toText(product?.presentations.unit.price));
  const [unitCost, setUnitCost] = React.useState(toText(product?.presentations.unit.cost));
  const [extras, setExtras] = React.useState<Record<Extra, PresDraft>>(() => {
    const draft = (t: Extra, factor: number): PresDraft => {
      const p = product?.presentations[t];
      return { on: !!p || (!product && t !== 'quarter'), factor: toText(p?.conversionFactor ?? factor), price: toText(p?.price), cost: toText(p?.cost) };
    };
    return { quarter: draft('quarter', 6), half: draft('half', 12), pack: draft('pack', 24) };
  });
  const [stock, setStock] = React.useState('0');
  const [minStock, setMinStock] = React.useState(toText(product?.minStockAlert ?? 12));
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);

  // Búsqueda en el catálogo maestro (con una pequeña espera para no consultar en cada letra).
  React.useEffect(() => {
    if (editing || !api) return;
    const q = tplQuery.trim();
    if (q.length < 2) { setTplResults([]); setTplError(''); return; }
    setTplLoading(true);
    const id = window.setTimeout(() => {
      api.productTemplates(q)
        .then(r => { setTplResults(r); setTplError(''); })
        .catch(e => setTplError(/pos_product_templates|PGRST202/i.test(String((e as Error)?.message ?? e))
          ? 'Falta activar el catálogo maestro: ejecute la migración 20261010060000_catalogo_maestro.sql.'
          : handleError(e)))
        .finally(() => setTplLoading(false));
    }, 250);
    return () => window.clearTimeout(id);
  }, [tplQuery, api, editing, handleError]);

  /** Llena el formulario con un producto conocido; la tienda solo agrega código, precio y stock. */
  const applyTemplate = (t: ProductTemplate) => {
    setName(t.name);
    setCategory(t.category);
    setBaseUnit(t.baseUnitName);
    if (t.packagingType) setPackaging(t.packagingType);
    setArt(t.art);
    setColor(t.color);
    setExtras(prev => ({
      quarter: { ...prev.quarter, on: false },
      half: { ...prev.half, on: !!t.halfFactor, factor: t.halfFactor ? String(t.halfFactor) : prev.half.factor },
      pack: { ...prev.pack, on: !!t.packFactor, factor: t.packFactor ? String(t.packFactor) : prev.pack.factor },
    }));
    setTplQuery('');
    setTplResults([]);
  };

  /** Reduce la foto en el celular (WebP, ~12 KB) antes de subirla. */
  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    try {
      setPhoto(await compressProductPhoto(file));
      setPhotoRemoved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo usar la foto.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const createCategory = async () => {
    if (!api) return;
    const value = await dialog.prompt('Por ejemplo: Turrones, Cigarrillos, Útiles escolares.', {
      title: 'Nueva categoría', placeholder: 'Nombre de la categoría', confirmText: 'Crear',
      validate: v => (v.trim().length < 2 ? 'Escriba al menos 2 letras.' : v.trim().length > 40 ? 'Máximo 40 letras.' : null),
    });
    if (!value) return;
    try {
      const saved = await api.saveCategory({ name: value.trim() });
      await refreshCatalog();
      setCategory(saved.name);
    } catch (e) {
      void dialog.alert(handleError(e), { tone: 'danger', title: 'No se pudo crear la categoría' });
    }
  };

  const setExtra = (t: Extra, patch: Partial<PresDraft>) => setExtras(prev => ({ ...prev, [t]: { ...prev[t], ...patch } }));
  const unitPriceNum = parseAmount(unitPrice);
  const plural = baseUnit.trim() ? `${baseUnit.trim()}s` : 'unidades';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const code = barcode.trim();
    if (name.trim().length < 2) return setError('Escriba el nombre del producto.');
    if (!code) return setError('Escriba o escanee el código de barras.');
    const owner = existingBarcodes.get(code);
    if (owner && owner !== product?.id) return setError('Ese código de barras ya es de otro producto.');
    if (Number.isNaN(unitPriceNum) || unitPriceNum <= 0) return setError('Escriba el precio por unidad.');

    const ts = Date.now();
    const pid = product?.id ?? '';
    const pres: Product['presentations'] = {
      unit: {
        ...(product?.presentations.unit ?? { id: `u_${ts}`, productId: pid }),
        type: 'unit', label: `Unidad (1 ${baseUnit.trim() || 'unidad'})`, shortLabel: 'UND', conversionFactor: 1,
        price: unitPriceNum, cost: unitCost.trim() ? parseAmount(unitCost) : null, isDefault: true,
      } as ProductPresentation,
    };
    for (const { type, name: label, short } of EXTRA) {
      const d = extras[type];
      if (!d.on) continue;
      const factor = Number(d.factor);
      const price = parseAmount(d.price);
      if (!Number.isInteger(factor) || factor < 2) return setError(`${label}: la cantidad debe ser un número entero mayor a 1.`);
      if (Number.isNaN(price) || price <= 0) return setError(`${label}: escriba el precio.`);
      const cost = d.cost.trim() ? parseAmount(d.cost) : null;
      if (cost !== null && Number.isNaN(cost)) return setError(`${label}: el costo no es válido.`);
      pres[type] = {
        ...(product?.presentations[type] ?? { id: `${type}_${ts}`, productId: pid }),
        type, label: `${label} (${factor} ${plural})`, shortLabel: `${short} (${factor}u)`, conversionFactor: factor, price, cost,
      } as ProductPresentation;
    }
    if (unitCost.trim() && Number.isNaN(parseAmount(unitCost))) return setError('Unidad: el costo no es válido.');

    const payload: Partial<Product> = {
      ...(product ?? {}),
      id: product?.id || undefined,
      name: name.trim(),
      barcode: code,
      category,
      baseUnitName: baseUnit.trim() || 'unidad',
      packagingType: packaging,
      flavorNote: note.trim(),
      expirationDate: expiration || null,
      isPromo,
      minStockAlert: Math.max(0, Number(minStock) || 0),
      accentColor: color,
      imageUrl: hasSavedPhoto ? product!.imageUrl : art ? `art:${art}` : (photoId(product?.imageUrl) ? null : product?.imageUrl ?? null),
      gradientBg: product?.gradientBg ?? 'from-brand-500/10 to-transparent',
      piecesPerPack: (pres.pack?.conversionFactor ?? pres.half?.conversionFactor ?? 1),
      presentations: pres,
      ...(editing ? {} : { stockInBaseUnits: Math.max(0, Number(stock) || 0) }),
    };
    setSaving(true);
    if (photo && api) {
      try {
        const ref = await api.uploadProductImage(photo);
        rememberPhoto(ref, photo);
        payload.imageUrl = ref;
      } catch (err) {
        setSaving(false);
        return setError(`No se pudo subir la foto: ${handleError(err)}`);
      }
    }
    const ok = await onSave(payload);
    setSaving(false);
    if (ok) onClose();
  };

  const field = 'h-12 w-full rounded-xl border border-ink/15 bg-white px-3 text-[15px] text-ink outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15';
  const label = 'mb-1.5 block text-sm font-bold text-ink';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()}
        className="flex max-h-[94vh] w-full max-w-lg flex-col rounded-t-3xl bg-paper text-ink shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-4">
          <h2 className="font-display text-[22px] font-bold leading-tight">{editing ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft hover:bg-ink/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-7 overflow-y-auto px-5 py-5">
          {!editing && (
            <section className="rounded-3xl bg-sun/45 p-4">
              <label htmlFor="pf-tpl" className="font-display text-lg font-bold">Buscar en productos conocidos</label>
              <p className="text-sm text-ink/75">Escriba la marca o el nombre (ej. «sayon», «inca kola», «oreo») y se llena solo.</p>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" />
                <input id="pf-tpl" value={tplQuery} onChange={e => setTplQuery(e.target.value)} autoFocus autoComplete="off"
                  placeholder="Marca o producto"
                  className="h-12 w-full rounded-full border border-ink/10 bg-white pl-11 pr-4 text-[15px] outline-none focus:border-brand-600" />
              </div>
              {tplLoading && <p className="mt-2 text-sm text-ink-soft">Buscando…</p>}
              {tplError && <p className="mt-2 text-sm font-bold text-fresa">{tplError}</p>}
              {tplResults.length > 0 && (
                <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
                  {tplResults.map(t => (
                    <li key={t.id}>
                      <button type="button" onClick={() => applyTemplate(t)}
                        className="squish flex w-full items-center gap-3 rounded-2xl bg-white p-2 text-left">
                        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-ink/[0.07]`} style={{ background: artSpot(t.color) }}>
                          <ProductArt art={t.art} color={t.color} className="h-10 w-10" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-bold">{t.name}</span>
                          <span className="block text-sm text-ink-soft">{t.brand}, {t.category}{t.packFactor ? `, paquete ×${t.packFactor}` : ''}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!tplLoading && !tplError && tplQuery.trim().length >= 2 && tplResults.length === 0 && (
                <p className="mt-2 text-sm text-ink/75">No está en la lista: llene los datos abajo.</p>
              )}
            </section>
          )}

          {/* Qué es */}
          <fieldset className="space-y-4">
            <legend className="font-display text-lg font-bold">El producto</legend>
            <div className="flex items-center gap-3 rounded-2xl bg-white p-3">
              <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-ink/[0.07]" style={{ background: photo || hasSavedPhoto ? '#fff' : artSpot(color) }}>
                <ProductThumb
                  product={{ name, category, accentColor: color, imageUrl: hasSavedPhoto ? product!.imageUrl : art ? `art:${art}` : null }}
                  previewUrl={photo} artClassName="h-[80%] w-[80%]" />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <div className="text-sm font-bold">Foto del producto</div>
                  <div className="text-sm text-ink-soft">
                    {photo ? `Lista para guardar (${Math.max(1, Math.round(dataUrlBytes(photo) / 1024))} KB)` : hasSavedPhoto ? 'Con foto' : 'Sin foto: se muestra un dibujo.'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className={`squish inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-ink px-3.5 text-sm font-bold text-white ${photoBusy ? 'opacity-60' : ''}`}>
                    <Camera className="h-4 w-4" /> {photoBusy ? 'Procesando…' : 'Tomar foto'}
                    <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={photoBusy} onChange={e => void pickPhoto(e)} />
                  </label>
                  <label className="squish inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 text-sm font-bold">
                    <ImagePlus className="h-4 w-4" /> Galería
                    <input type="file" accept="image/*" className="sr-only" disabled={photoBusy} onChange={e => void pickPhoto(e)} />
                  </label>
                  {(photo || hasSavedPhoto) && (
                    <button type="button" onClick={() => { setPhoto(null); setPhotoRemoved(true); }} aria-label="Quitar foto"
                      className="squish inline-flex h-10 w-10 items-center justify-center rounded-full text-fresa hover:bg-fresa/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {!photo && !hasSavedPhoto && (
                  <label className="inline-flex items-center gap-2 text-sm font-bold">
                    Color del dibujo <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
                  </label>
                )}
              </div>
            </div>
            <div>
              <label className={label} htmlFor="pf-name">Nombre</label>
              <input id="pf-name" className={field} value={name} onChange={e => setName(e.target.value)}   placeholder="Ej. Inca Kola 500 ml" />
            </div>
            <div>
              <label className={label} htmlFor="pf-code">Código de barras</label>
              <div className="flex gap-2">
                <input id="pf-code" className={`${field} font-display`} value={barcode} inputMode="numeric"
                  onChange={e => setBarcode(e.target.value.replace(/\s/g, ''))} placeholder="Ej. 7750182002346" />
                <button type="button" onClick={() => setScanning(true)} aria-label="Escanear código con la cámara"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink text-white active:scale-95">
                  <Camera className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div>
              <span className={label}>Categoría</span>
              <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                {categories.map(({ name: c }) => (
                  <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={category === c}
                    className={`h-10 rounded-full px-3.5 text-sm font-bold transition ${category === c ? 'bg-ink text-white' : 'border border-ink/15 bg-white text-ink'}`}>
                    {c}
                  </button>
                ))}
                <button type="button" onClick={() => void createCategory()}
                  className="inline-flex h-10 items-center gap-1 rounded-full border-2 border-dashed border-ink/25 px-3.5 text-sm font-bold text-ink-soft">
                  <Plus className="h-4 w-4" /> Nueva
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="pf-unit">Se cuenta por</label>
                <input id="pf-unit" className={field} value={baseUnit} onChange={e => setBaseUnit(e.target.value.toLowerCase())} placeholder="botella, bolsa…" />
              </div>
              <div>
                <label className={label} htmlFor="pf-pack">Empaque</label>
                <select id="pf-pack" className={field} value={packaging} onChange={e => setPackaging(e.target.value)}>
                  {PACKAGING.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={label} htmlFor="pf-note">Sabor o detalle <span className="font-normal text-ink-soft">(opcional)</span></label>
              <input id="pf-note" className={field} value={note} onChange={e => setNote(e.target.value)} placeholder="Ej. Sabor fresa" />
            </div>
          </fieldset>

          {/* Cómo se vende */}
          <fieldset className="space-y-3">
            <legend className="font-display text-lg font-bold">Cómo se vende</legend>
            <p className="text-sm text-ink-soft">El costo es opcional: con él, el resumen calcula la ganancia.</p>
            <div className="rounded-2xl border border-ink/10 bg-white p-4">
              <div className="font-bold">Unidad <span className="font-normal text-ink-soft">(1 {baseUnit || 'unidad'})</span></div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-ink-soft" htmlFor="pf-up">Precio S/</label>
                  <input id="pf-up" className={`${field} font-display`} inputMode="decimal" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-ink-soft" htmlFor="pf-uc">Costo S/</label>
                  <input id="pf-uc" className={`${field} font-display`} inputMode="decimal" value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="opcional" />
                </div>
              </div>
            </div>
            {EXTRA.map(({ type, name: pname }) => {
              const d = extras[type];
              const factor = Number(d.factor);
              const price = parseAmount(d.price);
              const each = d.on && factor > 1 && price > 0 ? round2(price / factor) : null;
              const saving = each !== null && unitPriceNum > 0 ? round2(unitPriceNum * factor - price) : null;
              return (
                <div key={type} className={`rounded-2xl border p-4 transition ${d.on ? 'border-ink/10 bg-white' : 'border-dashed border-ink/20'}`}>
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="font-bold">{pname}</span>
                    <input type="checkbox" checked={d.on} onChange={e => setExtra(type, { on: e.target.checked })} className="h-5 w-5 accent-brand-600" />
                  </label>
                  {d.on && (
                    <>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div>
                          <label className="mb-1 block text-sm text-ink-soft" htmlFor={`pf-${type}-f`}>Trae</label>
                          <input id={`pf-${type}-f`} className={`${field} font-display`} inputMode="numeric" value={d.factor}
                            onChange={e => setExtra(type, { factor: e.target.value.replace(/\D/g, '') })} />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm text-ink-soft" htmlFor={`pf-${type}-p`}>Precio S/</label>
                          <input id={`pf-${type}-p`} className={`${field} font-display`} inputMode="decimal" value={d.price}
                            onChange={e => setExtra(type, { price: e.target.value })} placeholder="0.00" />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm text-ink-soft" htmlFor={`pf-${type}-c`}>Costo S/</label>
                          <input id={`pf-${type}-c`} className={`${field} font-display`} inputMode="decimal" value={d.cost}
                            onChange={e => setExtra(type, { cost: e.target.value })} placeholder="opc." />
                        </div>
                      </div>
                      {each !== null && (
                        <p className="mt-2 text-sm text-ink-soft">
                          Sale a S/ {each.toFixed(2)} c/{baseUnit || 'unidad'}
                          {saving !== null && saving > 0 && <span className="font-bold text-brand-700">, el cliente ahorra S/ {saving.toFixed(2)}</span>}
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </fieldset>

          {/* Stock */}
          <fieldset className="space-y-4">
            <legend className="font-display text-lg font-bold">Stock</legend>
            <div className="grid grid-cols-2 gap-3">
              {editing ? (
                <div>
                  <span className={label}>En almacén</span>
                  <div className="flex h-12 items-center rounded-xl bg-ink/5 px-3 font-display text-lg font-bold">
                    {product!.stockInBaseUnits} <span className="ml-1 text-sm font-normal text-ink-soft">{plural}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">Cámbielo con «Reponer».</p>
                </div>
              ) : (
                <div>
                  <label className={label} htmlFor="pf-stock">Stock inicial</label>
                  <input id="pf-stock" className={`${field} font-display`} inputMode="numeric" value={stock} onChange={e => setStock(e.target.value.replace(/\D/g, ''))} />
                  <p className="mt-1 text-sm text-ink-soft">En {plural}.</p>
                </div>
              )}
              <div>
                <label className={label} htmlFor="pf-min">Avisar si baja de</label>
                <input id="pf-min" className={`${field} font-display`} inputMode="numeric" value={minStock} onChange={e => setMinStock(e.target.value.replace(/\D/g, ''))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="pf-exp">Vence <span className="font-normal text-ink-soft">(opcional)</span></label>
                <input id="pf-exp" type="date" className={field} value={expiration ?? ''} onChange={e => setExpiration(e.target.value)} />
              </div>
              <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-ink/15 bg-white px-3 h-12">
                <input type="checkbox" checked={isPromo} onChange={e => setIsPromo(e.target.checked)} className="h-5 w-5 accent-brand-600" />
                <span className="text-[15px] font-bold">Mostrar como oferta</span>
              </label>
            </div>
          </fieldset>
        </div>

        <div className="border-t border-ink/10 px-5 py-4">
          {error && <p className="mb-3 text-[15px] font-bold text-fresa" role="alert">{error}</p>}
          <button type="submit" disabled={saving}
            className="h-14 w-full rounded-2xl bg-brand-600 text-base font-bold text-white transition active:scale-[0.99] disabled:opacity-50">
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar al catálogo'}
          </button>
        </div>
      </form>

      <CameraScanner open={scanning} onClose={() => setScanning(false)} kind="barcode" title="Escanear código del producto"
        onDetected={code => { setBarcode(code); return `Código ${code}`; }} />
    </div>
  );
};
