import React from 'react';
import { Minus, Package, Plus } from 'lucide-react';
import type { Product } from '../../types/pos';
import { ProductThumb } from '../../app/ProductThumb';
import { artSpot } from '../../app/ProductArt';
import { photoId } from '../../lib/productImages';

/*
 * Tarjeta de producto de Pre-Venta pensada para pedir rápido:
 * la cantidad se cambia en la misma tarjeta y el paquete tiene su propio botón.
 * Tocar la imagen o el nombre abre el detalle (presentaciones, precio editable).
 */

interface Props {
  product: Product;
  status: 'ok' | 'low' | 'out';
  unitQty: number;
  packQty: number;
  layout: 'grid' | 'list';
  onOpen: () => void;
  onAddUnit: () => void;
  onRemoveUnit: () => void;
  onAddPack: () => void;
}

const money = (n: number) => `S/ ${n.toFixed(2)}`;

const Stepper: React.FC<{ qty: number; disabled: boolean; name: string; onAdd: () => void; onRemove: () => void; compact?: boolean }> =
  ({ qty, disabled, name, onAdd, onRemove, compact }) => {
    const h = compact ? 'h-10' : 'h-11';
    if (qty === 0) {
      return (
        <button type="button" onClick={onAdd} disabled={disabled} aria-label={`Agregar 1 ${name}`}
          className={`squish flex ${h} ${compact ? 'w-10 justify-center' : 'w-full justify-center gap-1.5 px-3'} items-center rounded-full bg-ink text-[15px] font-bold text-white disabled:bg-ink/15 disabled:text-ink/40`}>
          <Plus className="h-5 w-5" strokeWidth={2.6} />{!compact && 'Agregar'}
        </button>
      );
    }
    return (
      <div className={`flex ${h} ${compact ? 'w-[120px]' : 'w-full'} items-center justify-between rounded-full bg-brand-50 p-1 ring-1 ring-brand-600/25`}>
        <button type="button" onClick={onRemove} aria-label={`Quitar 1 ${name}`}
          className="squish flex aspect-square h-full items-center justify-center rounded-full bg-white text-ink shadow-sm">
          <Minus className="h-4 w-4" strokeWidth={2.6} />
        </button>
        <span className="min-w-8 text-center text-[17px] font-extrabold tabular-nums text-ink" aria-live="polite">{qty}</span>
        <button type="button" onClick={onAdd} disabled={disabled} aria-label={`Agregar 1 ${name}`}
          className="squish flex aspect-square h-full items-center justify-center rounded-full bg-ink text-white disabled:opacity-40">
          <Plus className="h-4 w-4" strokeWidth={2.6} />
        </button>
      </div>
    );
  };

export const ProductCard: React.FC<Props> = ({ product, status, unitQty, packQty, layout, onOpen, onAddUnit, onRemoveUnit, onAddPack }) => {
  const pack = product.presentations.pack ?? product.presentations.half;
  const out = status === 'out';
  const hasPhoto = !!photoId(product.imageUrl);
  const tileBg = hasPhoto ? '#ffffff' : artSpot(product.accentColor, 0.07);

  const stockNote = out
    ? <span className="font-bold text-fresa">Agotado</span>
    : status === 'low'
      ? <span className="text-[#8a5a00]">Quedan {product.stockInBaseUnits}</span>
      : null;

  const packButton = pack && (
    <button type="button" onClick={onAddPack} disabled={out} aria-label={`Agregar 1 ${pack.type === 'pack' ? 'paquete' : 'medio'} de ${product.name}`}
      className="squish relative flex h-9 w-full items-center gap-1 rounded-xl border border-ink/12 bg-white px-2 text-left text-[13px] disabled:opacity-40">
      <Package className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
      <span className="min-w-0 flex-1 whitespace-nowrap text-ink-soft">×{pack.conversionFactor}</span>
      <span className="shrink-0 font-bold tabular-nums text-ink">{money(pack.price)}</span>
      {packQty > 0
        ? <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-xs font-bold text-white">{packQty}</span>
        : <Plus className="h-3.5 w-3.5 shrink-0 text-ink" strokeWidth={2.8} />}
    </button>
  );

  if (layout === 'list') {
    return (
      <li className="flex items-center gap-3 rounded-2xl bg-white p-2.5 ring-1 ring-ink/[0.06]">
        <button type="button" onClick={onOpen} aria-label={`Ver ${product.name}`}
          className={`relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl ${out ? 'opacity-50 grayscale' : ''}`} style={{ background: tileBg }}>
          <ProductThumb product={product} artClassName="h-[78%] w-[78%]" />
        </button>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <h4 className="line-clamp-2 text-[15px] font-bold leading-snug text-ink">{product.name}</h4>
          <div className="mt-0.5 flex items-baseline gap-2 text-sm">
            <span className="font-display text-base font-bold tabular-nums text-ink">{money(product.presentations.unit.price)}</span>
            {pack && <span className="truncate text-ink-soft">{pack.type === 'pack' ? 'Paq' : 'Medio'} ×{pack.conversionFactor} {money(pack.price)}</span>}
          </div>
          {stockNote && <div className="text-sm">{stockNote}</div>}
        </button>
        <Stepper compact qty={unitQty} disabled={out} name={product.name} onAdd={onAddUnit} onRemove={onRemoveUnit} />
      </li>
    );
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-ink/[0.06]">
      <button type="button" onClick={onOpen} aria-label={`Ver ${product.name}`}
        className="relative flex aspect-[4/3.4] w-full items-center justify-center overflow-hidden" style={{ background: tileBg }}>
        <span className={`flex h-full w-full items-center justify-center ${out ? 'opacity-45 grayscale' : ''}`}>
          <ProductThumb product={product} artClassName="h-[74%] w-[74%] drop-shadow-[0_8px_10px_rgba(20,67,61,0.14)]" />
        </span>
        {product.isPromo && (
          <span className="absolute left-2 top-2 rounded-md bg-fresa px-2 py-0.5 text-xs font-extrabold text-white">Oferta</span>
        )}
        {out && <span className="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full bg-ink/85 px-3 py-1 text-xs font-bold text-white">Agotado</span>}
      </button>
      <div className="flex flex-1 flex-col gap-2 p-3 pt-2.5">
        <button type="button" onClick={onOpen} className="text-left">
          <h4 className="line-clamp-2 min-h-[2.5rem] text-[15px] font-bold leading-tight text-ink">{product.name}</h4>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="font-display text-xl font-bold tabular-nums text-ink">{money(product.presentations.unit.price)}</span>
            {status === 'low' && <span className="text-xs text-[#8a5a00]">Quedan {product.stockInBaseUnits}</span>}
          </div>
        </button>
        <div className="mt-auto space-y-2">
          {packButton}
          <Stepper qty={unitQty} disabled={out} name={product.name} onAdd={onAddUnit} onRemove={onRemoveUnit} />
        </div>
      </div>
    </article>
  );
};
