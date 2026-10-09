import React, { useEffect, useState } from 'react';
import { Lock, X } from 'lucide-react';
import { formatSoles, parseAmount } from '../../domain/money';
import { usePos } from '../../state/PosContext';
import type { Shift } from '../../types/pos';

interface Props {
  onClose: () => void;
}

/** Arqueo y cierre de turno: compara el efectivo esperado con el contado. */
export const ShiftCloseModal: React.FC<Props> = ({ onClose }) => {
  const { api, outbox, setOpenShift, logout, handleError, syncNow } = usePos();
  const [summary, setSummary] = useState<Shift | null>(null);
  const [closed, setClosed] = useState<Shift | null>(null);
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pendingOps = outbox.length;

  useEffect(() => {
    if (!api) return;
    (async () => {
      try {
        await syncNow();
        setSummary(await api.currentShift());
      } catch (e) {
        setError(handleError(e));
      }
    })();
  }, [api, handleError, syncNow]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!api) return;
    const amount = parseAmount(counted);
    if (Number.isNaN(amount)) {
      setError('Ingrese el efectivo contado (ej. 350.50).');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api.closeShift(amount, notes.trim() || undefined);
      setClosed(result);
      setOpenShift(null);
    } catch (err) {
      setError(handleError(err));
    } finally {
      setLoading(false);
    }
  };

  const row = (label: string, value: number | null | undefined, strong = false) => (
    <div className={`flex justify-between ${strong ? 'font-black text-ink' : 'text-ink-soft'}`}>
      <span>{label}</span>
      <span className="font-display">{formatSoles(value)}</span>
    </div>
  );

  const shown = closed ?? summary;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-ink text-white p-4 flex items-center justify-between">
          <h3 className="font-black  text-sm flex items-center gap-2"><Lock className="w-4 h-4" /> Cierre de Turno</h3>
          {!closed && <button onClick={onClose} aria-label="Cerrar"><X className="w-5 h-5" /></button>}
        </div>

        <div className="p-5 space-y-4 text-sm">
          {pendingOps > 0 && !closed && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-xs">
              Hay {pendingOps} operación(es) sin sincronizar. Conéctese a internet antes de cerrar para que el arqueo sea exacto.
            </div>
          )}

          {!shown ? (
            <p className="text-center text-ink/45 py-6">{error || 'Calculando resumen…'}</p>
          ) : (
            <div className="space-y-1.5 bg-cream/60 rounded-2xl p-3 border border-ink/10">
              {row('Fondo inicial', shown.openingCash)}
              {Object.entries(shown.byMethod).map(([method, total]) => row(`Cobrado ${method}`, total))}
              {shown.byKind.DEVOLUCION ? row('Devoluciones (anulaciones)', shown.byKind.DEVOLUCION) : null}
              <div className="border-t border-ink/10 my-1" />
              {row('Efectivo esperado en caja', shown.expectedCash ?? shown.expectedCashNow, true)}
              {closed && row('Efectivo contado', closed.countedCash, true)}
              {closed && (
                <div className={`flex justify-between font-black ${(closed.difference ?? 0) < 0 ? 'text-red-600' : 'text-brand-700'}`}>
                  <span>{(closed.difference ?? 0) < 0 ? 'Faltante' : (closed.difference ?? 0) > 0 ? 'Sobrante' : 'Cuadre exacto'}</span>
                  <span className="font-display">{formatSoles(Math.abs(closed.difference ?? 0))}</span>
                </div>
              )}
              <div className="text-xs text-ink/45 pt-1">Pedidos emitidos en el turno: {shown.ordersCreated}</div>
            </div>
          )}

          {closed ? (
            <button onClick={() => void logout()} className="w-full py-3.5 bg-ink text-white font-black rounded-xl">
              TURNO CERRADO · SALIR
            </button>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <label className="block">
                <span className="block text-xs font-bold text-ink-soft  mb-1">Efectivo contado en caja</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={counted}
                  onChange={e => setCounted(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-cream/60 border border-ink/15 rounded-xl px-4 py-3 text-xl font-black focus:outline-none focus:border-brand-500"
                  required
                />
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Observaciones (opcional)"
                className="w-full bg-cream/60 border border-ink/15 rounded-xl px-3 py-2 text-sm"
              />
              {error && <p className="text-red-600 text-xs text-center">{error}</p>}
              <button type="submit" disabled={loading || !summary}
                className="w-full py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black rounded-xl">
                {loading ? 'Cerrando…' : 'Cerrar turno'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
