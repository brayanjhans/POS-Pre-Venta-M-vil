import React, { useEffect, useRef, useState } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { Delete, Loader2 } from 'lucide-react';
import { errorMessage, isNetworkError } from '../../services/rpc';
import { KEYS, storage } from '../../services/storage';
import { usePos } from '../../state/PosContext';
import { setScreenTheme } from '../../lib/screenTheme';

/*
 * Login con usuario y PIN. No se muestra la lista de personas: cada quien escribe su usuario
 * y, según su rol, entra a su pantalla (admin, caja o pre-venta).
 * La credencial (fotocheck) se completa mientras se escribe el usuario: es el único elemento
 * llamativo; el resto es sobrio. El PIN se marca con el teclado propio (nunca el del celular).
 */

const greeting = (d: Date) => {
  const h = d.getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
};

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const KEY_CLASS = 'h-[64px] rounded-2xl border border-ink/10 bg-white font-display text-[28px] font-semibold text-ink shadow-[0_1px_0_rgba(31,42,48,0.08)] transition active:scale-95 active:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-600';

export const LoginScreen: React.FC = () => {
  const { login } = usePos();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const userRef = useRef<HTMLInputElement>(null);
  const typingUser = useRef(false);

  useEffect(() => {
    setScreenTheme('paper');
    const id = setInterval(() => setNow(new Date()), 30000);
    // En el celular de cada vendedor queda escrito su usuario: solo marca el PIN.
    void storage.get<string>(KEYS.lastUsername).then(last => {
      if (last) setUsername(last);
      else userRef.current?.focus();
    });
    return () => { clearInterval(id); setScreenTheme('ink'); };
  }, []);

  const fail = (message: string) => {
    setError(message);
    setPin('');
    setShake(s => s + 1);
  };

  const submit = async (value: string) => {
    const user = username.trim().toLowerCase();
    if (loading) return;
    if (!user) { fail('Escriba su usuario.'); userRef.current?.focus(); return; }
    if (value.length < 4) { fail('El PIN tiene de 4 a 6 números.'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await login(user, value);
      if (!result.ok) fail(result.message ?? 'Usuario o PIN incorrecto.');
    } catch (e) {
      fail(isNetworkError(e) ? 'Sin conexión. Para entrar se necesita internet.' : errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const pressDigit = (d: string) => {
    if (loading) return;
    userRef.current?.blur();
    setPin(p => (p.length >= 6 ? p : p + d));
    setError('');
  };
  const backspace = () => setPin(p => p.slice(0, -1));

  // Teclado físico para el PIN (lector o PC), salvo mientras se escribe el usuario.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typingUser.current) return;
      if (/^\d$/.test(e.key)) pressDigit(e.key);
      else if (e.key === 'Backspace') backspace();
      else if (e.key === 'Enter') void submit(pin);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const initials = username.trim().slice(0, 2).toUpperCase();

  return (
    <MotionConfig reducedMotion="user">
      <div className="h-full overflow-y-auto bg-paper text-ink">
        <form
          className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-6 pt-5"
          onSubmit={e => { e.preventDefault(); void submit(pin); }}
        >
          {/* Marca + hora */}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-600 font-display text-lg font-extrabold text-white">
                P
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-paper bg-tag" />
              </span>
              <span className="font-display text-xl font-bold tracking-tight">Pre-Venta</span>
            </div>
            <span className="text-[15px] font-bold tabular-nums text-ink-soft">
              {now.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' })}
            </span>
          </header>

          <h1 className="mt-7 font-display text-[40px] font-bold leading-[1.02] tracking-tight [font-stretch:88%]">{greeting(now)}</h1>
          <p className="mt-2 text-[17px] text-ink-soft">Escriba su usuario y su PIN.</p>

          {/* Credencial: se completa con el usuario escrito */}
          <div className="mt-6 overflow-hidden rounded-[20px] border border-ink/10 bg-white shadow-[0_1px_0_rgba(31,42,48,0.06),0_14px_28px_-20px_rgba(31,42,48,0.55)]">
            <div className="flex justify-center pt-3">
              <span className="h-2.5 w-10 rounded-full bg-paper ring-1 ring-inset ring-ink/15" />
            </div>
            <div className="flex items-center gap-4 p-4 pt-3">
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl font-display text-[28px] font-bold transition-colors ${
                initials ? 'bg-brand-50 text-brand-800' : 'bg-paper text-ink/25'}`}>
                {initials || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <label htmlFor="login-user" className="block text-sm font-bold text-ink-soft">Usuario</label>
                <input
                  id="login-user"
                  ref={userRef}
                  value={username}
                  onChange={e => { setUsername(e.target.value.replace(/\s/g, '').toLowerCase()); setError(''); }}
                  onFocus={() => { typingUser.current = true; }}
                  onBlur={() => { typingUser.current = false; }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); userRef.current?.blur(); } }}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                  enterKeyHint="next"
                  placeholder="ej. carlos.m"
                  className="mt-0.5 w-full border-b-2 border-ink/15 bg-transparent pb-1 font-display text-[22px] font-bold text-ink outline-none placeholder:font-sans placeholder:text-lg placeholder:font-normal placeholder:text-ink/30 focus:border-brand-600"
                />
              </div>
            </div>
          </div>

          {/* PIN */}
          <p className="mt-6 text-center text-[17px] font-bold">PIN</p>
          <motion.div key={shake} animate={shake ? { x: [0, -9, 9, -6, 6, -2, 0] } : undefined} transition={{ duration: 0.4 }}
            className="mt-3 flex justify-center gap-4" role="status" aria-label={`PIN ingresado: ${pin.length} dígitos`}>
            {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
              <span key={i} className={`h-4 w-4 rounded-full transition-colors duration-150 ${
                error ? 'bg-fresa' : i < pin.length ? 'bg-brand-600' : 'bg-transparent ring-2 ring-inset ring-ink/25'}`} />
            ))}
          </motion.div>
          <p className="mt-3 min-h-6 text-center text-[15px] font-bold text-fresa" role="alert">{error}</p>

          <div className="mt-auto grid grid-cols-3 gap-2.5 pt-3">
            {KEYPAD.map(d => (
              <button key={d} type="button" onClick={() => pressDigit(d)} className={KEY_CLASS}>{d}</button>
            ))}
            <button type="button" onClick={backspace} aria-label="Borrar"
              className="flex h-[64px] items-center justify-center rounded-2xl text-ink-soft transition active:scale-95 active:bg-ink/5">
              <Delete className="h-7 w-7" />
            </button>
            <button type="button" onClick={() => pressDigit('0')} className={KEY_CLASS}>0</button>
            <button type="submit" disabled={pin.length < 4 || !username.trim() || loading}
              className="flex h-[64px] items-center justify-center rounded-2xl bg-brand-600 text-[17px] font-bold text-white transition active:scale-95 disabled:bg-ink/10 disabled:text-ink/35">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Entrar'}
            </button>
          </div>
        </form>
      </div>
    </MotionConfig>
  );
};
