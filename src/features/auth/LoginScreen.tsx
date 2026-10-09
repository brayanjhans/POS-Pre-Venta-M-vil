import React, { useEffect, useState } from 'react';
import { ArrowLeft, Delete, ShieldCheck, User as UserIcon, WifiOff } from 'lucide-react';
import { publicApi } from '../../services/api';
import { errorMessage, isNetworkError } from '../../services/rpc';
import { KEYS, storage } from '../../services/storage';
import { usePos } from '../../state/PosContext';
import { ROLE_LABELS, type LoginUser } from '../../types/pos';

export const LoginScreen: React.FC = () => {
  const { login } = usePos();
  const [users, setUsers] = useState<LoginUser[]>([]);
  const [selected, setSelected] = useState<LoginUser | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [cached, lastUsername] = await Promise.all([
        storage.get<LoginUser[]>(KEYS.loginUsers),
        storage.get<string>(KEYS.lastUsername),
      ]);
      if (cached) setUsers(cached);
      try {
        const fresh = await publicApi.loginUsers();
        setUsers(fresh);
        setOffline(false);
        await storage.set(KEYS.loginUsers, fresh);
        const last = fresh.find(u => u.username === lastUsername);
        if (last) setSelected(last);
      } catch (e) {
        if (isNetworkError(e)) setOffline(true);
        else setError(errorMessage(e));
      }
    })();
  }, []);

  const submit = async (value: string) => {
    if (!selected || value.length < 4 || loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await login(selected.username, value);
      if (!result.ok) {
        setError(result.message ?? 'No se pudo iniciar sesión.');
        setPin('');
      }
    } catch (e) {
      setError(isNetworkError(e) ? 'Sin conexión. Para iniciar sesión se necesita internet.' : errorMessage(e));
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const pressDigit = (d: string) => {
    if (pin.length >= 6) return;
    setPin(pin + d);
    setError('');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6">
      <div className="w-full max-w-sm bg-slate-800 rounded-3xl p-6 shadow-2xl border border-slate-700">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-black text-center mb-1">Punto de Venta</h1>

        {offline && (
          <div className="my-3 p-2.5 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-200 text-xs flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Sin conexión. Conéctese a internet para iniciar sesión.</span>
          </div>
        )}

        {!selected ? (
          <>
            <p className="text-slate-400 text-center mb-5 text-sm">¿Quién va a trabajar?</p>
            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              {users.length === 0 && !offline && (
                <p className="text-center text-slate-500 text-sm py-6">Cargando usuarios…</p>
              )}
              {users.map(u => (
                <button
                  key={u.username}
                  type="button"
                  onClick={() => { setSelected(u); setPin(''); setError(''); }}
                  className="w-full flex items-center gap-3 p-3 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-2xl transition text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold truncate">{u.fullName}</div>
                    <div className="text-[11px] text-slate-400">{ROLE_LABELS[u.role]} · @{u.username}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <form onSubmit={e => { e.preventDefault(); void submit(pin); }}>
            <button
              type="button"
              onClick={() => { setSelected(null); setPin(''); setError(''); }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white mb-3"
            >
              <ArrowLeft className="w-4 h-4" /> Cambiar usuario
            </button>
            <p className="text-center text-sm text-slate-300">
              <span className="font-black text-white">{selected.fullName}</span>
              <span className="block text-[11px] text-slate-400">{ROLE_LABELS[selected.role]}</span>
            </p>

            <div className="flex justify-center gap-3 my-5" aria-label="PIN ingresado">
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                <span key={i} className={`w-4 h-4 rounded-full border-2 ${i < pin.length ? 'bg-emerald-400 border-emerald-400' : 'border-slate-500'}`} />
              ))}
            </div>
            {/* Campo oculto para poder escribir el PIN con teclado físico. */}
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="sr-only"
              autoFocus
              aria-label="PIN"
            />
            {error && <p className="text-red-400 text-sm mb-3 text-center font-medium">{error}</p>}

            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                <button key={d} type="button" onClick={() => pressDigit(d)}
                  className="py-4 bg-slate-900 hover:bg-slate-700 rounded-2xl text-2xl font-black transition active:scale-95">
                  {d}
                </button>
              ))}
              <button type="button" onClick={() => setPin(pin.slice(0, -1))}
                className="py-4 bg-slate-900 hover:bg-slate-700 rounded-2xl flex items-center justify-center transition" aria-label="Borrar">
                <Delete className="w-6 h-6" />
              </button>
              <button type="button" onClick={() => pressDigit('0')}
                className="py-4 bg-slate-900 hover:bg-slate-700 rounded-2xl text-2xl font-black transition active:scale-95">
                0
              </button>
              <button type="submit" disabled={pin.length < 4 || loading}
                className="py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 rounded-2xl font-black text-sm transition">
                {loading ? '...' : 'ENTRAR'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
