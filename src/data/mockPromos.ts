import { PromoBanner } from '../types/pos';

export const INITIAL_PROMOS: PromoBanner[] = [
  {
    id: 'promo_1',
    badgeText: 'PROMOCIÓN DESTACADA',
    tag: 'MAYORISTA',
    discountBadge: '-15% OFF',
    title: 'COMBO INKA KOLA 500ML (12U) + SUBLIME (24U)',
    subtitle: '12x Botellas retornables/pet heladas + 1 display completo de chocolate con maní para alta rotación.',
    originalPrice: 73.00,
    offerPrice: 62.00,
    savingText: 'Ahorras S/ 11',
    associatedBarcodes: ['7750182001011', '7750885002012'], // Assuming these exist in mockProducts
  },
  {
    id: 'promo_2',
    badgeText: 'OFERTA EXPRESS',
    tag: 'BODEGAS',
    discountBadge: '-10% OFF',
    title: 'PACK MIXTO GALLETAS (MOROCHAS + RITZ)',
    subtitle: 'Lleva 1 display de Morochas y 1 display de Ritz a un precio especial para reponer stock.',
    originalPrice: 22.00,
    offerPrice: 19.80,
    savingText: 'Ahorras S/ 2.20',
    associatedBarcodes: ['7751234567891', '7751234567894'], // Example barcodes
  }
];
