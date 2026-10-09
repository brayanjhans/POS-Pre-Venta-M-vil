import React, { useState } from 'react';
import { User, ShieldCheck } from 'lucide-react';

interface Props {
  onLogin: (pin: string) => void;
  error?: string;
}

export const LoginScreen: React.FC<Props> = ({ onLogin, error }) => {
  const [pin, setPin] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length >= 4) {
      onLogin(pin);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6">
      <div className="w-full max-w-sm bg-slate-800 rounded-3xl p-8 shadow-2xl border border-slate-700">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
        </div>
        
        <h1 className="text-2xl font-black text-center mb-2">Punto de Venta</h1>
        <p className="text-slate-400 text-center mb-8 text-sm">Ingrese su PIN de acceso para iniciar su turno.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">PIN de Seguridad</label>
            <input 
              type="password" 
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-4 text-center text-3xl font-black tracking-[0.5em] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              placeholder="****"
              autoFocus
            />
            {error && <p className="text-red-400 text-sm mt-3 text-center font-medium">{error}</p>}
          </div>

          <button 
            type="submit"
            disabled={pin.length < 4}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:bg-slate-600 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
          >
            INGRESAR
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-500">
          <p>PINs de prueba:</p>
          <div className="flex justify-center gap-4 mt-2">
            <span className="bg-slate-700 px-2 py-1 rounded">1111 (Admin)</span>
            <span className="bg-slate-700 px-2 py-1 rounded">2222 (Vendedor)</span>
            <span className="bg-slate-700 px-2 py-1 rounded">3333 (Cajera)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
