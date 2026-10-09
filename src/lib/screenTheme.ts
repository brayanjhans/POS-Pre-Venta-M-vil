import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

/**
 * Color de la zona del sistema (hora, batería) según la pantalla actual:
 *   - "paper": fondo claro (login, Caja, Admin) con íconos oscuros.
 *   - "brand": verde de marca (Pre-Venta) con íconos claros.
 *   - "ink":   tinta (carga inicial) con íconos claros.
 */
export function setScreenTheme(theme: 'paper' | 'brand' | 'ink'): void {
  document.documentElement.dataset.screen = theme;
  if (Capacitor.isNativePlatform()) {
    void SystemBars.setStyle({ style: theme === 'paper' ? SystemBarsStyle.Light : SystemBarsStyle.Dark }).catch(() => {});
  }
}
