import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { usePos } from '../../state/PosContext';

/** Se muestra cuando el usuario debe cambiar su PIN (primer ingreso o PIN restablecido). */
export const ChangePinScreen: React.FC = () => {
  const { api, session, setSessionUser, logout, handleError } = usePos();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!api) return;
    if (next !== confirm) {
      setError('Los PIN nuevos no coinciden.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setSessionUser(await api.changePin(current, next));
    } catch (err) {
      setError(handleError(err));
    } finally {
      setLoading(false);
    }
  };

  const pinInput = (value: string, onChange: (v: string) => void, label: string) => (
    <label className="block">
      <span className="block text-xs font-bold text-ink-soft   mb-1">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="w-full bg-cream/60 border border-ink/15 rounded-xl px-4 py-3 text-center text-2xl font-black tracking-[0.4em] focus:outline-none focus:border-brand-500"
        required
        minLength={4}
      />
    </label>
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-full bg-cream p-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-xl border border-ink/10 space-y-4">
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center">
            <KeyRound className="w-7 h-7 text-amber-600" />
          </div>
        </div>
        <h1 className="text-xl font-black text-center">Cambie su PIN</h1>
        <p className="text-ink-soft text-center text-sm">
          Hola <strong>{session?.user.fullName}</strong>. Por seguridad, elija un PIN personal de 4 a 6 dígitos
          que solo usted conozca.
        </p>
        {pinInput(current, setCurrent, 'PIN actual (temporal)')}
        {pinInput(next, setNext, 'PIN nuevo')}
        {pinInput(confirm, setConfirm, 'Repita el PIN nuevo')}
        {error && <p className="text-red-600 text-sm text-center font-medium">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl">
          {loading ? 'Guardando…' : 'Guardar PIN'}
        </button>
        <button type="button" onClick={() => void logout()} className="w-full py-2 text-sm font-bold text-ink/45">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
};
