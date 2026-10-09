import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

/**
 * Tono de la pantalla actual: "light" (login, fondo papel) o "dark" (resto, barra tinta arriba).
 * Pinta el fondo de las zonas del sistema y pone la hora/batería en el color que se lea.
 */
export function setScreenTheme(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.screen = theme;
  if (Capacitor.isNativePlatform()) {
    void SystemBars.setStyle({ style: theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Dark }).catch(() => {});
  }
}
