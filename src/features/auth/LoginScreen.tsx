import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, LockOpen, LogIn, Store, User } from 'lucide-react';
import { useDialog } from '../../app/DialogProvider';
import { errorMessage, isNetworkError } from '../../services/rpc';
import { KEYS, storage } from '../../services/storage';
import { usePos } from '../../state/PosContext';
import { setScreenTheme } from '../../lib/screenTheme';
import type { Catalog } from '../../types/pos';

/*
 * Inicio de sesión con usuario y PIN (diseño de referencia: carpeta /login).
 * No se lista a las personas: cada quien escribe sus datos y entra a su pantalla según su rol.
 * El PIN usa solo el teclado numérico del celular (no hay teclado propio en pantalla).
 */

export const LoginScreen: React.FC = () => {
  const { login } = usePos();
  const dialog = useDialog();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [storeName, setStoreName] = useState('Pre-Venta');
  const userRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setScreenTheme('paper');
    void Promise.all([storage.get<string>(KEYS.lastUsername), storage.get<Catalog>(KEYS.catalog)]).then(([last, catalog]) => {
      if (catalog?.settings.store_name) setStoreName(catalog.settings.store_name);
      // En el celular de cada vendedor su usuario queda escrito: solo marca el PIN.
      if (last) { setUsername(last); pinRef.current?.focus(); } else userRef.current?.focus();
    });
    return () => setScreenTheme('ink');
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = username.trim().toLowerCase();
    if (loading) return;
    if (!user) { setError('Escriba su usuario.'); userRef.current?.focus(); return; }
    if (!/^\d{4,6}$/.test(pin)) { setError('El PIN tiene de 4 a 6 números.'); pinRef.current?.focus(); return; }
    setLoading(true);
    setError('');
    try {
      const result = await login(user, pin);
      if (!result.ok) {
        setError(result.message ?? 'Usuario o PIN incorrecto.');
        setPin('');
        pinRef.current?.focus();
      }
    } catch (err) {
      setError(isNetworkError(err) ? 'Sin conexión. Para entrar se necesita internet.' : errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const field = 'h-12 w-full rounded-xl border border-ink/15 bg-white text-[15px] text-ink shadow-[0_1px_2px_rgba(31,42,48,0.04)] outline-none transition placeholder:text-ink/35 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20';

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-paper text-ink">
      {/* Cabecera mínima con la marca */}
      <header className="sticky top-0 z-10 border-b border-ink/5 bg-paper/90 backdrop-blur">
        <div className="flex h-16 items-center justify-center gap-2 px-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
            <Store className="h-[18px] w-[18px]" />
          </span>
          <span className="truncate font-display text-base font-bold tracking-tight">{storeName}</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-100 bg-brand-50 text-brand-600 shadow-sm">
            <LockOpen className="h-7 w-7" />
          </div>
          <h1 className="mb-1.5 font-display text-2xl font-bold tracking-tight">Iniciar sesión</h1>
          <p className="text-sm text-ink-soft">Ingrese su usuario y PIN para entrar a su cuenta</p>
        </div>

        <form className="space-y-4" onSubmit={e => void submit(e)} noValidate>
          <div>
            <label htmlFor="login-user" className="mb-1.5 block text-sm font-semibold text-ink">Usuario</label>
            <div className="relative flex items-center">
              <User className="pointer-events-none absolute left-3.5 h-5 w-5 text-ink/40" />
              <input
                id="login-user"
                ref={userRef}
                value={username}
                onChange={e => { setUsername(e.target.value.replace(/\s/g, '').toLowerCase()); setError(''); }}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                enterKeyHint="next"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); pinRef.current?.focus(); } }}
                placeholder="ej. carlos.m"
                className={`${field} pl-11 pr-4`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-pin" className="mb-1.5 block text-sm font-semibold text-ink">PIN</label>
            <div className="relative flex items-center">
              <Lock className="pointer-events-none absolute left-3.5 h-5 w-5 text-ink/40" />
              <input
                id="login-pin"
                ref={pinRef}
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="current-password"
                enterKeyHint="go"
                maxLength={6}
                value={pin}
                onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                placeholder="••••"
                className={`${field} pl-11 pr-12 font-display tracking-[0.3em] placeholder:tracking-[0.3em]`}
              />
              <button type="button" onClick={() => setShowPin(v => !v)} aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                className="absolute right-1.5 flex h-10 w-10 items-center justify-center rounded-lg text-ink/45 transition hover:text-ink active:scale-95">
                {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <p className="min-h-5 text-sm font-semibold text-fresa" role="alert">{error}</p>

          <button type="submit" disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-base font-semibold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-70">
            {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Ingresando…</> : <><LogIn className="h-5 w-5" /> Iniciar sesión</>}
          </button>

          <div className="pt-1 text-center">
            <button type="button"
              onClick={() => void dialog.alert('Pida al administrador que le restablezca el PIN desde Administración → Usuarios.', { title: '¿Olvidó su PIN?' })}
              className="text-sm font-medium text-ink-soft transition hover:text-brand-700">
              ¿Olvidó su PIN?
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};
