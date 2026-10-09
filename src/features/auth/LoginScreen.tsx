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
  const [storeName, setStoreName] = useState('Distribuidora Golosinas');
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

  const field = 'w-full bg-white border border-slate-200/90 rounded-2xl py-3.5 pl-12 pr-4 text-slate-800 text-sm font-medium shadow-[0_2px_8px_rgba(15,62,54,0.04)] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#0e3a33] focus:border-transparent';

  return (
    <div className="flex h-full flex-col justify-between overflow-y-auto bg-[#faf9f4] font-sans text-slate-800 selection:bg-emerald-100 selection:text-emerald-900">
      <main className="mx-auto flex min-h-full w-full max-w-[420px] flex-col justify-between px-5 py-6">
        <div className="flex w-full flex-col items-center gap-6">
          {/* Cabecera mínima con la marca */}
          <header className="flex w-full items-center justify-center gap-3 pt-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0e3a33] text-white shadow-sm">
              <Store className="h-5 w-5" strokeWidth={2} />
            </div>
            <h1 className="text-base font-extrabold uppercase tracking-wider text-[#0e3a33] sm:text-lg">
              {storeName}
            </h1>
          </header>

          {/* Hero Card con la imagen y degradado */}
          <section className="relative flex w-full flex-col items-center overflow-hidden rounded-3xl pb-4 pt-1">
            <div className="relative h-56 w-full overflow-hidden rounded-3xl shadow-[0_12px_36px_-4px_rgba(14,58,51,0.08),_0_4px_16px_-2px_rgba(14,58,51,0.04)]"
              style={{
                maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)'
              }}>
              <img
                src="https://lh3.googleusercontent.com/aida/AEtjO1UraVjZS-xvMEy1j1kS2xW5LyomRM2fc3i5fB2Mk3u4yhAQy-vvBtRLEIbLemCiuDMss5PpQUAGVYPefkAARlo22qNpJFVJ4__zNZmr2aosA0lCL5yLMoKAKvkvv0tuRn_UryqxCYsTo8pJO3XuNd4vXfrWO-wxBn80B_o6v70IL-f5ffcEsgPN5KMOjBCmthWTsEyQg7Uv7A5byT-QviUAeHIi0DCVwCnGPaIWnc03Smiq1RqCRb0nEA"
                alt="Variedad de golosinas"
                className="h-full w-full scale-105 object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#faf9f4] via-transparent to-black/20"></div>
            </div>

            <div className="relative z-10 -mt-6 flex w-full flex-col items-center px-4 text-center">
              <div className="mb-2.5 flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-emerald-900/5 bg-white p-3 text-[#0e3a33] shadow-md">
                <LockOpen className="h-6 w-6" strokeWidth={2} />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[#0a2f29]">
                ¡Bienvenido a tu portal!
              </h2>
              <p className="mt-1 max-w-[280px] text-xs font-medium text-slate-500 sm:text-sm">
                Ingresa tus credenciales para gestionar pedidos y stock
              </p>
            </div>
          </section>

          <form className="mt-1 flex w-full flex-col gap-4" onSubmit={e => void submit(e)} noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-user" className="ml-1 text-xs font-semibold tracking-wide text-slate-700">
                Usuario
              </label>
              <div className="relative flex items-center">
                <User className="pointer-events-none absolute left-4 h-5 w-5 text-slate-400" strokeWidth={2} />
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
                  placeholder="Ingresa tu usuario"
                  className={field}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-pin" className="ml-1 text-xs font-semibold tracking-wide text-slate-700">
                PIN
              </label>
              <div className="relative flex items-center">
                <Lock className="pointer-events-none absolute left-4 h-5 w-5 text-slate-400" strokeWidth={2} />
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
                  className={`${field} !pr-12 text-base font-semibold tracking-widest`}
                />
                <button type="button" onClick={() => setShowPin(v => !v)} aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                  className="absolute right-3.5 rounded-lg p-1 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none">
                  {showPin ? <EyeOff className="h-5 w-5" strokeWidth={2} /> : <Eye className="h-5 w-5" strokeWidth={2} />}
                </button>
              </div>
            </div>

            <p className="min-h-5 text-sm font-semibold text-red-500" role="alert">{error}</p>

            <button type="submit" disabled={loading}
              className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-[#0e3a33] px-6 py-4 font-semibold text-white shadow-[0_8px_20px_-4px_rgba(14,58,51,0.35)] transition-all duration-200 hover:bg-[#134e45] active:scale-[0.99] disabled:opacity-70">
              {loading ? <><Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.2} /> <span className="text-base tracking-wide">Ingresando…</span></> : <><LogIn className="h-5 w-5" strokeWidth={2.2} /> <span className="text-base tracking-wide">Ingresar al sistema</span></>}
            </button>
          </form>
        </div>

        <footer className="w-full pb-2 pt-6 text-center">
          <button type="button"
            onClick={() => void dialog.alert('Pida al administrador que le restablezca el PIN desde Administración → Usuarios.', { title: '¿Olvidó su PIN?' })}
            className="inline-block rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition-colors hover:text-[#0e3a33] focus:outline-none">
            ¿Olvidaste tu PIN? Contactar soporte
          </button>
          <div aria-hidden="true" className="mx-auto mt-4 h-1 w-32 rounded-full bg-slate-300/60"></div>
        </footer>
      </main>
    </div>
  );
};
