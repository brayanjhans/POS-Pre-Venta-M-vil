import React from 'react';

/** Sello de estrella festoneado (estilo Olipop) para destacar: "Oferta", "Nuevo", contadores. */
export const Starburst: React.FC<{
  children: React.ReactNode;
  color?: string;
  size?: number;
  spin?: boolean;
  className?: string;
}> = ({ children, color = '#fdda79', size = 56, spin = false, className = '' }) => {
  // 14 puntas suaves alrededor de un círculo.
  const points = 14;
  const path = Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? 50 : 43;
    const a = (Math.PI * i) / points - Math.PI / 2;
    return `${i === 0 ? 'M' : 'L'}${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ') + 'Z';
  return (
    // Si llega una posición (absolute/fixed) en className, se respeta; si no, queda relativo.
    <span className={`${/\b(absolute|fixed)\b/.test(className) ? '' : 'relative '}inline-flex shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className={`absolute inset-0 h-full w-full ${spin ? 'starburst-spin' : ''}`} aria-hidden>
        <path d={path} fill={color} strokeLinejoin="round" />
      </svg>
      <span className="relative text-center font-display text-[13px] font-bold leading-none text-ink">{children}</span>
    </span>
  );
};
