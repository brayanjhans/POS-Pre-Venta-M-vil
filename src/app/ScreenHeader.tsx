import React from 'react';
import { TONE, type Tone } from './tones';

interface Props {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Botón a la izquierda del título (ej. abrir el menú en el celular). */
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  /** Color de la sección (burbuja del ícono). */
  tone?: Tone;
}

/** Cabecera común de las pantallas (Caja, Admin): sobre papel, título en Bricolage, sin adornos. */
export const ScreenHeader: React.FC<Props> = ({ icon, title, subtitle, leading, actions, tone = 'mint' }) => (
  <header className="relative z-20 flex items-center justify-between gap-3 border-b border-ink/10 bg-paper px-4 py-3 text-ink md:px-6 md:py-4">
    <div className="flex min-w-0 items-center gap-3">
      {leading}
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-ink ${TONE[tone].bg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <h1 className="truncate font-display text-[24px] font-bold leading-tight">{title}</h1>
        {subtitle && <p className="truncate text-sm text-ink-soft">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </header>
);

/** Botón de la cabecera: blanco con borde fino, alto táctil de 44 px. */
export const HeaderButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
  <button
    type="button"
    {...props}
    className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-ink/10 bg-white px-3 text-sm font-bold text-ink transition hover:border-ink/25 active:scale-95 disabled:opacity-50 ${className}`}
  />
);
