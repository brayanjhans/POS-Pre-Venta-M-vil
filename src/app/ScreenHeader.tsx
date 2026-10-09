import React from 'react';

interface Props {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Botón a la izquierda del ícono (ej. abrir el menú en el celular). */
  leading?: React.ReactNode;
  actions?: React.ReactNode;
}

/** Cabecera común de las pantallas (Caja, Admin): compacta, con el verde de marca. */
export const ScreenHeader: React.FC<Props> = ({ icon, title, subtitle, leading, actions }) => (
  <header className="relative z-20 flex items-center justify-between gap-3 bg-gradient-to-r from-brand-700 to-brand-600 px-4 py-3 text-white shadow-sm md:px-6 md:py-4">
    <div className="flex min-w-0 items-center gap-3">
      {leading}
      <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 sm:flex">
        {icon}
      </div>
      <div className="min-w-0">
        <h1 className="truncate text-lg font-black leading-tight md:text-xl">{title}</h1>
        {subtitle && <p className="truncate text-xs text-white/75">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </header>
);

/** Botón de la cabecera: blanco translúcido, alto táctil de 40 px. */
export const HeaderButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
  <button
    type="button"
    {...props}
    className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-white/15 px-3 text-xs font-bold text-white ring-1 ring-white/20 transition hover:bg-white/25 active:scale-95 disabled:opacity-50 ${className}`}
  />
);
