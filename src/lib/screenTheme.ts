import { Capacitor, SystemBars, SystemBarsStyle, registerPlugin } from '@capacitor/core';

/** Plugin nativo propio (android/.../ScreenColorPlugin.java). */
const ScreenColor = registerPlugin<{ setColor: (opts: { color: string }) => Promise<void> }>('ScreenColor');

const COLORS = { paper: '#FFF7EC', brand: '#008168', ink: '#14433D' } as const;

/**
 * Color de la zona del sistema (hora, batería) según la pantalla actual:
 *   - "paper": fondo claro (login, Caja, Admin) con íconos oscuros.
 *   - "brand": verde de marca (Pre-Venta) con íconos claros.
 *   - "ink":   tinta (carga inicial) con íconos claros.
 * Se pinta en la web (WebView moderno, de borde a borde) y en la ventana nativa
 * (WebView antiguo, donde Capacitor deja un margen nativo arriba).
 */
export function setScreenTheme(theme: keyof typeof COLORS): void {
  document.documentElement.dataset.screen = theme;
  if (Capacitor.isNativePlatform()) {
    void SystemBars.setStyle({ style: theme === 'paper' ? SystemBarsStyle.Light : SystemBarsStyle.Dark }).catch(() => {});
    void ScreenColor.setColor({ color: COLORS[theme] }).catch(() => {});
  }
}
