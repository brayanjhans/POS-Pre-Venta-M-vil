import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.preventa.golosinas',
  appName: 'POS Pre-Venta',
  webDir: 'dist',
  // Fondo del WebView mientras carga y en los bordes: el mismo oscuro de la app.
  backgroundColor: '#f2f4ef',
  plugins: {
    SystemBars: {
      // Iconos claros (hora, batería) sobre el fondo oscuro.
      style: 'DARK',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
