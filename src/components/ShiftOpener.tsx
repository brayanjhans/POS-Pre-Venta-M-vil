import React, { useState } from 'react';
import { Play, Wallet } from 'lucide-react';

interface Props {
  userName: string;
  onStartShift: (initialCash: number) => void;
  onLogout: () => void;
}

export const ShiftOpener: React.FC<Props> = ({ userName, onStartShift, onLogout }) => {
  const [initialCash, setInitialCash] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartShift(initialCash ? parseFloat(initialCash) : 0);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 text-slate-800 p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-xl border border-slate-200">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Play className="w-8 h-8 text-blue-600 ml-1" />
          </div>
        </div>
        
        <h1 className="text-2xl font-black text-center mb-1">Apertura de Turno</h1>
        <p className="text-slate-500 text-center mb-8 text-sm">Bienvenido, <span className="font-bold text-slate-800">{userName}</span></p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fondo de Caja (Opcional)</label>
            <p className="text-[10px] text-slate-400 mb-3 leading-tight">Si empiezas tu turno con sencillo para dar vueltos, anótalo aquí. Si no, déjalo en blanco.</p>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-slate-400 font-bold">S/</span>
              </div>
              <input 
                type="number" 
                step="0.10"
                min="0"
                value={initialCash}
                onChange={(e) => setInitialCash(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-4 text-2xl font-black text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="0.00"
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
          >
            <Wallet className="w-5 h-5" />
            INICIAR TURNO AHORA
          </button>
        </form>

        <button 
          onClick={onLogout}
          className="w-full mt-4 py-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};
