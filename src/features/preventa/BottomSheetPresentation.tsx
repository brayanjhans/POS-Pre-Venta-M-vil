import React from 'react';
import type { CartItem, PresentationType } from '../../types/pos';
import { X, Check, Package, Layers, Sparkles, AlertCircle, TrendingDown, Pencil, RotateCcw } from 'lucide-react';
import { isValidUnitPrice } from '../../domain/cart';
import { parseAmount, round2 } from '../../domain/money';

interface Props {
  item: CartItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdatePresentation: (cartItemId: string, presentation: PresentationType, quantity: number, unitPrice: number) => void;
}

export const BottomSheetPresentation: React.FC<Props> = ({
  item,
  isOpen,
  onClose,
  onUpdatePresentation,
}) => {
  // Los hooks deben ejecutarse siempre, antes de cualquier return condicional.
  const [selectedPres, setSelectedPres] = React.useState<PresentationType>(item?.selectedPresentation ?? 'unit');
  const [qty, setQty] = React.useState<number>(item?.quantity ?? 1);
  // Precio de venta editable: viene pre-cargado con el de catálogo (o el ya editado en la línea).
  const [priceText, setPriceText] = React.useState<string>(item ? item.unitPrice.toFixed(2) : '');

  React.useEffect(() => {
    if (item) {
      setSelectedPres(item.selectedPresentation);
      setQty(item.quantity);
      setPriceText(item.unitPrice.toFixed(2));
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const product = item.product;
  // Al cambiar de producto, el estado puede tener por un render la presentación del anterior.
  const currentPresentation = product.presentations[selectedPres] ?? product.presentations.unit;
  const requiredBaseUnits = qty * currentPresentation.conversionFactor;
  const isStockSufficient = requiredBaseUnits <= product.stockInBaseUnits;
  const listPrice = currentPresentation.price;
  const unitPrice = parseAmount(priceText);
  const isPriceValid = isValidUnitPrice(unitPrice);
  const isPriceEdited = isPriceValid && unitPrice !== listPrice;
  const subtotal = isPriceValid ? round2(qty * unitPrice) : 0;

  /** Al cambiar de presentación se pre-carga su precio (o el editado, si se vuelve a la de la línea). */
  const selectPresentation = (type: PresentationType) => {
    setSelectedPres(type);
    const price = type === item.selectedPresentation ? item.unitPrice : product.presentations[type]!.price;
    setPriceText(price.toFixed(2));
  };

  // Cálculo del ahorro mayorista respecto al precio unitario suelto
  const unitPriceIndividual = product.presentations.unit.price;
  const equivalentCostAtUnitPrice = currentPresentation.conversionFactor * unitPriceIndividual;
  const unitSavings = Math.max(0, equivalentCostAtUnitPrice - currentPresentation.price);

  // Sin stock suficiente se permite vender (queda en negativo y el admin lo regulariza).
  const handleConfirm = () => {
    if (!isPriceValid) return;
    onUpdatePresentation(item.cartItemId, currentPresentation.type, qty, unitPrice);
    onClose();
  };

  const presentationConfig: { type: PresentationType; icon: React.ReactNode; labelTag: string }[] = [
    { 
      type: 'unit', 
      icon: <Package className="w-5 h-5 text-emerald-600" />,
      labelTag: 'Venta por Unidad'
    },
    { 
      type: 'quarter', 
      icon: <Layers className="w-5 h-5 text-blue-600" />,
      labelTag: 'Cuarto de Paquete'
    },
    { 
      type: 'half', 
      icon: <Layers className="w-5 h-5 text-amber-600" />,
      labelTag: 'Medio Paquete / Display'
    },
    { 
      type: 'pack', 
      icon: <Sparkles className="w-5 h-5 text-emerald-700" />,
      labelTag: 'Fardo / Paquete Mayorista'
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in" onClick={onClose}>
      <div 
        className="w-full max-w-md bg-white border-t-4 border-[#16a34a] rounded-t-3xl p-5 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar superior */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-3" />

        {/* Header con nombre del producto */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-[#16a34a] uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {product.category}
              </span>
              <span className="text-slate-400 font-mono text-xs">
                {product.barcode}
              </span>
            </div>
            <h3 className="text-base font-black text-slate-900 mt-1 leading-snug">
              {product.name}
            </h3>
            {product.flavorNote && (
              <p className="text-xs text-slate-500 mt-0.5">
                {product.flavorNote}
              </p>
            )}
            <div className="text-xs text-slate-600 mt-1">
              Stock en Almacén: <strong className="text-slate-900">{product.stockInBaseUnits} {product.baseUnitName}s</strong>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de Presentación: 3 Opciones Táctiles (Unidad, Medio, Paquete) */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 tracking-wider uppercase">
              Seleccionar Presentación de Venta
            </label>
            <span className="text-xs text-emerald-700 font-bold">Precios independientes</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {presentationConfig.map(({ type, icon }) => {
              const pres = product.presentations[type];
              if (!pres) return null;
              const isSelected = selectedPres === type;
              const pricePerUnit = pres.price / pres.conversionFactor;
              const savingForThis = Math.max(0, (pres.conversionFactor * unitPriceIndividual) - pres.price);

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => selectPresentation(type)}
                  className={`relative flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                    isSelected 
                      ? 'border-[#16a34a] bg-emerald-50/80 ring-2 ring-[#16a34a]/30 shadow-md' 
                      : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${
                      isSelected 
                        ? 'bg-[#16a34a] text-white border-[#16a34a]' 
                        : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}>
                      {icon}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900">
                          {pres.label}
                        </span>
                        {isSelected && (
                          <span className="text-xs bg-[#16a34a] text-white font-black px-1.5 py-0.2 rounded-full uppercase">
                            ACTIVO
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-semibold text-emerald-800">
                          Descuenta: <strong>x{pres.conversionFactor} {product.baseUnitName}s</strong>
                        </span>
                        <span>·</span>
                        <span className="text-slate-600 font-mono">
                          equiv. S/ {pricePerUnit.toFixed(2)}/u
                        </span>
                      </div>

                      {savingForThis > 0 && (
                        <div className="flex items-center gap-1 text-xs text-emerald-700 font-bold mt-1">
                          <TrendingDown className="w-3 h-3" />
                          <span>Ahorro cliente: S/ {savingForThis.toFixed(2)} vs suelto</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-black text-slate-900 font-mono">
                      S/ {pres.price.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                      {pres.shortLabel}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selector de Cantidad (Con soporte para fracciones) */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Cantidad de {currentPresentation.shortLabel}
            </span>
            <span className="text-xs font-mono text-emerald-700 font-bold">
              Descontará: {requiredBaseUnits} {product.baseUnitName}s
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="w-12 h-12 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-2xl flex items-center justify-center active:scale-95 transition border border-slate-300 shadow-xs"
            >
              -
            </button>

            <div className="flex-1 text-center bg-white border border-slate-300 rounded-xl px-2 shadow-xs relative overflow-hidden flex items-center justify-center">
              <input 
                type="number"
                min="1"
                value={qty || ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setQty(isNaN(val) || val < 1 ? 1 : val);
                }}
                className="w-full text-center text-3xl font-black text-slate-900 font-mono focus:outline-hidden py-2 bg-transparent"
              />
            </div>

            <button
              type="button"
              onClick={() => setQty(qty + 1)}
              className="w-12 h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-2xl flex items-center justify-center active:scale-95 transition shadow-md shadow-emerald-700/20"
            >
              +
            </button>
          </div>

          {/* Accesos rápidos (Solo enteros) */}
          <div className="grid grid-cols-5 gap-2 mt-3">
            {[1, 2, 3, 4, 5].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setQty(val)}
                className={`py-1.5 text-xs font-bold rounded-lg border transition ${
                  qty === val 
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-[0_4px_10px_rgba(5,150,105,0.3)]' 
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
                }`}
              >
                {val}
              </button>
            ))}
          </div>

          {!isStockSufficient && (
            <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                <strong>⚠️ Venta sin Stock:</strong> Solo hay {product.stockInBaseUnits} {product.baseUnitName}s. Se descontará en negativo y requerirá compra a terceros.
              </span>
            </div>
          )}
        </div>

        {/* Precio de venta editable */}
        <div className={`rounded-2xl p-4 border mb-4 ${isPriceEdited ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="sheet-unit-price" className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
              <Pencil className="w-3.5 h-3.5" /> Precio por {currentPresentation.shortLabel}
            </label>
            <span className="text-xs text-slate-500">
              Lista: <strong className="font-mono text-slate-700">S/ {listPrice.toFixed(2)}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-white border border-slate-300 rounded-xl px-3 shadow-xs focus-within:border-emerald-500">
              <span className="text-slate-500 font-bold mr-1">S/</span>
              <input
                id="sheet-unit-price"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={priceText}
                onChange={e => setPriceText(e.target.value.replace(/[^\d.,]/g, ''))}
                onFocus={e => e.target.select()}
                className="w-full text-2xl font-black text-slate-900 font-mono focus:outline-hidden py-2 bg-transparent"
              />
            </div>
            {isPriceEdited && (
              <button
                type="button"
                onClick={() => setPriceText(listPrice.toFixed(2))}
                className="h-12 px-3 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1 hover:bg-slate-100"
                title="Volver al precio de lista"
              >
                <RotateCcw className="w-4 h-4" /> Lista
              </button>
            )}
          </div>
          {!isPriceValid && (
            <p className="mt-2 text-xs font-medium text-red-600">Ingrese un precio mayor a 0 (máximo 2 decimales).</p>
          )}
          {isPriceEdited && (
            <p className="mt-2 text-xs font-medium text-amber-800">
              Precio editado: {unitPrice > listPrice ? '+' : '-'}S/ {Math.abs(round2(unitPrice - listPrice)).toFixed(2)} por {currentPresentation.shortLabel} respecto a la lista.
            </p>
          )}
        </div>

        {/* Resumen del Subtotal y Botón de Aplicar */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 font-medium">Subtotal a la fila:</div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              S/ {subtotal.toFixed(2)}
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isPriceValid}
            className={`disabled:opacity-40 disabled:cursor-not-allowed flex-1 py-3.5 px-4 rounded-xl font-black flex items-center justify-center gap-2 text-sm uppercase tracking-wider transition-all shadow-md ${
              isStockSufficient
                ? 'bg-[#16a34a] hover:bg-[#15803d] text-white active:scale-98 shadow-emerald-700/20 cursor-pointer'
                : 'bg-amber-500 hover:bg-amber-600 text-white active:scale-98 shadow-amber-700/20 cursor-pointer'
            }`}
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
            Confirmar Presentación
          </button>
        </div>
      </div>
    </div>
  );
};
