import React from 'react';
import type { Product } from '../../types/pos';
import { Wine, Sparkles, Cookie, Candy, Droplets } from 'lucide-react';

interface Props {
  product: Product;
  size?: 'sm' | 'md' | 'lg';
}

export const ProductVisualBadge: React.FC<Props> = ({ product, size = 'md' }) => {
  const getCategoryIcon = () => {
    switch (product.category) {
      case 'Bebidas':
        return <Wine className={size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'} />;
      case 'Chocolates':
        return <Sparkles className={size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'} />;
      case 'Galletas':
        return <Cookie className={size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'} />;
      case 'Golosinas':
        return <Candy className={size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'} />;
      default:
        return <Droplets className={size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'} />;
    }
  };

  const sizeClasses = {
    sm: 'w-8 h-8 rounded-lg text-xs',
    md: 'w-11 h-11 rounded-xl text-sm',
    lg: 'w-16 h-16 rounded-2xl text-base',
  };

  return (
    <div 
      className={`relative shrink-0 flex items-center justify-center font-bold overflow-hidden border shadow-inner transition-all ${sizeClasses[size]}`}
      style={{
        backgroundColor: `${product.accentColor}15`,
        borderColor: `${product.accentColor}40`,
        color: product.accentColor,
      }}
    >
      {/* Glow ambiental de fondo */}
      <div 
        className="absolute inset-0 opacity-25 filter blur-xs"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${product.accentColor}, transparent 70%)`
        }}
      />

      {/* Ícono temático */}
      <div className="relative z-10 filter drop-shadow">
        {getCategoryIcon()}
      </div>

      {/* Brillo de empaque tipo celofán o botella de vidrio */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
    </div>
  );
};
