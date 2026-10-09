import React from 'react';
import { Calendar, Clock, Package, RefreshCw, TrendingUp, Users, Wallet } from 'lucide-react';
import { formatSoles } from '../../domain/money';
import { usePos } from '../../state/PosContext';
import type { Dashboard, Product } from '../../types/pos';

interface Props {
  products: Product[];
  onRegularize: (product: Product) => void;
}

const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);

/** Resumen con cifras reales del servidor (ventas, cobros, deudas, turnos) y alertas de inventario. */
export const DashboardTab: React.FC<Props> = ({ products, onRegularize }) => {
  const { api, handleError } = usePos();
  const [data, setData] = React.useState<Dashboard | null>(null);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      setData(await api.dashboard());
      setError('');
    } catch (e) {
      setError(handleError(e));
    } finally {
      setLoading(false);
    }
  }, [api, handleError]);

  React.useEffect(() => { void load(); }, [load]);

  const active = products.filter(p => p.isActive !== false);
  const lowStock = active.filter(p => p.stockInBaseUnits <= p.minStockAlert).sort((a, b) => a.stockInBaseUnits - b.stockInBaseUnits);
  const expiring = active
    .filter(p => p.expirationDate && daysUntil(p.expirationDate) <= 30)
    .sort((a, b) => daysUntil(a.expirationDate!) - daysUntil(b.expirationDate!));
  const vsYesterday = data && data.salesYesterday > 0 ? ((data.salesToday - data.salesYesterday) / data.salesYesterday) * 100 : null;

  const card = (icon: React.ReactNode, title: string, value: React.ReactNode, sub?: React.ReactNode) => (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
      <div className="text-slate-500 mb-1 flex items-center gap-2 text-xs font-bold uppercase">{icon} {title}</div>
      <div className="text-2xl font-black text-slate-900 font-mono">{value}</div>
      {sub && <div className="text-xs font-bold mt-1 text-slate-500">{sub}</div>}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-black text-slate-900 uppercase">Dashboard General</h3>
          <p className="text-xs text-slate-500">Cifras del servidor en tiempo real</p>
        </div>
        <button type="button" onClick={() => void load()} className="p-2 bg-white border border-slate-300 rounded-xl" title="Actualizar">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {card(<TrendingUp className="w-4 h-4 text-[#16a34a]" />, 'Ventas de hoy', data ? formatSoles(data.salesToday) : '…',
          data && <>{data.ordersToday} pedidos{vsYesterday !== null && <> · <span className={vsYesterday >= 0 ? 'text-emerald-600' : 'text-red-600'}>{vsYesterday >= 0 ? '+' : ''}{vsYesterday.toFixed(1)}% vs ayer</span></>}</>)}
        {card(<Wallet className="w-4 h-4 text-blue-500" />, 'Cobrado hoy', data ? formatSoles(data.collectedToday) : '…', 'Ventas + abonos − devoluciones')}
        {card(<Calendar className="w-4 h-4 text-indigo-500" />, 'Ventas del mes', data ? formatSoles(data.salesMonth) : '…',
          data && (data.profitMonth !== null ? `Ganancia estimada: ${formatSoles(data.profitMonth)}` : 'Cargue costos para ver la ganancia'))}
        {card(<Users className="w-4 h-4 text-red-500" />, 'Por cobrar (fiado)', data ? formatSoles(data.totalDebt) : '…',
          data && `${data.debtors} clientes · ${data.pendingOrders} pedidos pendientes`)}
      </div>

      {data && data.openShifts.length > 0 && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <h4 className="text-sm font-black text-slate-900 uppercase border-b border-slate-100 pb-2 mb-3">Turnos abiertos</h4>
          <div className="grid md:grid-cols-3 gap-2 text-xs">
            {data.openShifts.map(s => (
              <div key={s.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-bold">{s.userName}</div>
                <div className="text-slate-500">Desde {new Date(s.openedAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</div>
                <div className="font-mono">Efectivo esperado: {formatSoles(s.expectedCashNow)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <h4 className="text-sm font-black text-slate-900 uppercase border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-500" /> Alertas de stock ({lowStock.length})
          </h4>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {lowStock.length === 0 && <div className="text-xs text-slate-400 py-4 text-center">Todo en orden.</div>}
            {lowStock.map(p => (
              <div key={p.id} className="flex justify-between items-center text-xs">
                <div className="truncate max-w-[70%]">
                  <div className="font-bold text-slate-900 truncate">{p.name}</div>
                  {p.stockInBaseUnits < 0 && (
                    <button type="button" onClick={() => onRegularize(p)} className="text-xs mt-0.5 text-blue-600 font-bold hover:underline">
                      Regularizar compra externa
                    </button>
                  )}
                </div>
                <div className={`font-black font-mono px-2 py-1 rounded ${p.stockInBaseUnits < 0 ? 'bg-red-100 text-red-700' : 'bg-amber-50 text-amber-600'}`}>
                  {p.stockInBaseUnits} u
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 border-t-4 border-t-red-500">
          <h4 className="text-sm font-black text-slate-900 uppercase border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-red-500" /> Próximos a vencer ({expiring.length})
          </h4>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {expiring.length === 0 && <div className="text-xs text-slate-400 py-4 text-center">Todo en orden.</div>}
            {expiring.map(p => {
              const d = daysUntil(p.expirationDate!);
              return (
                <div key={p.id} className="flex justify-between items-center text-xs">
                  <div className="truncate max-w-[65%]">
                    <div className="font-bold text-slate-900 truncate">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.expirationDate}</div>
                  </div>
                  <div className={`font-black font-mono px-2 py-1 rounded ${d < 0 ? 'bg-red-100 text-red-700' : d <= 7 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-50 text-yellow-700'}`}>
                    {d < 0 ? 'Expiró' : `${d} d`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
