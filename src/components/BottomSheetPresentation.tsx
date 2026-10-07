import React from 'react';
import { CartItem, PresentationType } from '../types/pos';
import { ExtendedProduct } from '../data/mockProducts';
import { X, Check, Package, Layers, Sparkles, AlertCircle, TrendingDown } from 'lucide-react';

interface Props {
  item: CartItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdatePresentation: (cartItemId: string, presentation: PresentationType, quantity: number) => void;
}

export const BottomSheetPresentation: React.FC<Props> = ({
  item,
  isOpen,
  onClose,
  onUpdatePresentation,
}) => {
  if (!isOpen || !item) return null;

  const product = item.product as ExtendedProduct;
  const [selectedPres, setSelectedPres] = React.useState<PresentationType>(item.selectedPresentation);
  const [qty, setQty] = React.useState<number>(item.quantity);

  React.useEffect(() => {
    if (item) {
      setSelectedPres(item.selectedPresentation);
      setQty(item.quantity);
    }
  }, [item]);

  const currentPresentation = product.presentations[selectedPres]!;
  const requiredBaseUnits = qty * currentPresentation.conversionFactor;
  const isStockSufficient = requiredBaseUnits <= product.stockInBaseUnits;
  const subtotal = qty * currentPresentation.price;

  // Cálculo del ahorro mayorista respecto al precio unitario suelto
  const unitPriceIndividual = product.presentations.unit.price;
  const equivalentCostAtUnitPrice = currentPresentation.conversionFactor * unitPriceIndividual;
  const unitSavings = Math.max(0, equivalentCostAtUnitPrice - currentPresentation.price);

  const handleConfirm = () => {
    if (!isStockSufficient) return;
    onUpdatePresentation(item.cartItemId, selectedPres, qty);
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
              <span className="text-slate-400 font-mono text-[11px]">
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
            <label className="text-[11px] font-bold text-slate-700 tracking-wider uppercase">
              Seleccionar Presentación de Venta
            </label>
            <span className="text-[10px] text-emerald-700 font-bold">Precios independientes</span>
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
                  onClick={() => setSelectedPres(type)}
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
                          <span className="text-[9px] bg-[#16a34a] text-white font-black px-1.5 py-0.2 rounded-full uppercase">
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
                        <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold mt-1">
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
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
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
              onClick={() => setQty(Math.max(0.25, qty - (qty <= 1 ? 0.25 : 1)))}
              className="w-12 h-12 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-2xl flex items-center justify-center active:scale-95 transition border border-slate-300 shadow-xs"
            >
              -
            </button>

            <div className="flex-1 text-center bg-white border border-slate-300 rounded-xl py-2 px-4 shadow-xs">
              <span className="text-3xl font-black text-slate-900 font-mono">{qty}</span>
              <span className="text-xs text-slate-500 ml-2 font-bold uppercase">
                {currentPresentation.type === 'pack' ? 'Paquetes' : 
                 currentPresentation.type === 'half' ? 'Medios' : 
                 currentPresentation.type === 'quarter' ? 'Cuartos' : 'Unid.'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setQty(qty + (qty < 1 ? 0.25 : 1))}
              className="w-12 h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-2xl flex items-center justify-center active:scale-95 transition shadow-md shadow-emerald-700/20"
            >
              +
            </button>
          </div>

          {/* Accesos rápidos (Fracciones y enteros) */}
          <div className="grid grid-cols-5 gap-2 mt-3">
            {[
              { val: 0.25, label: '1/4' },
              { val: 0.5, label: '1/2' },
              { val: 1, label: '1' },
              { val: 2, label: '2' },
              { val: 5, label: '5' }
            ].map(item => (
              <button
                key={item.label}
                type="button"
                onClick={() => setQty(item.val)}
                className={`py-1.5 text-xs font-bold rounded-lg border transition ${
                  qty === item.val 
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-[0_4px_10px_rgba(5,150,105,0.3)]' 
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {!isStockSufficient && (
            <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-[11px] flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                <strong>⚠️ Venta sin Stock:</strong> Solo hay {product.stockInBaseUnits} {product.baseUnitName}s. Se descontará en negativo y requerirá compra a terceros.
              </span>
            </div>
          )}
        </div>

        {/* Resumen del Subtotal y Botón de Aplicar */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Subtotal a la fila:</div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              S/ {subtotal.toFixed(2)}
            </div>
          </div>

          <button
            type="button"
            disabled={false}
            onClick={handleConfirm}
            className={`flex-1 py-3.5 px-4 rounded-xl font-black flex items-center justify-center gap-2 text-sm uppercase tracking-wider transition-all shadow-md ${
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
