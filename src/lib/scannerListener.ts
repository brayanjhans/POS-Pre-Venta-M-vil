/**
 * Lógica y Algoritmo para Captura de Pistola Lectora de Códigos de Barras (Modo HID Teclado)
 * 
 * Principio Físico:
 * Una pistola escáner HID inyecta caracteres secuenciales con un intervalo menor a 30-50 milisegundos
 * y finaliza enviando un caracter 'Enter' (Keycode 13 / \n).
 * La velocidad humana promedio entre pulsaciones es de 120ms - 300ms.
 */

export interface ScannerConfig {
  maxIntervalMs?: number; // Umbral máximo entre pulsaciones (default 50ms)
  minBarcodeLength?: number; // Longitud mínima para considerarse código válido (default 3)
  onScan: (barcode: string) => void;
}

export class BarcodeScannerListener {
  private buffer: string = '';
  private lastKeyTime: number = 0;
  private maxIntervalMs: number;
  private minBarcodeLength: number;
  private onScan: (barcode: string) => void;
  private isListening: boolean = false;
  private keydownHandler?: (e: KeyboardEvent) => void;

  constructor(config: ScannerConfig) {
    this.maxIntervalMs = config.maxIntervalMs || 60;
    this.minBarcodeLength = config.minBarcodeLength || 3;
    this.onScan = config.onScan;
  }

  public start(): void {
    if (this.isListening) return;
    this.isListening = true;

    this.keydownHandler = (e: KeyboardEvent) => {
      // Ignorar teclas modificadoras
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
        return;
      }

      const now = Date.now();
      const diff = now - this.lastKeyTime;

      // Si ha pasado mucho tiempo desde la última tecla y no es el inicio, resetear buffer
      if (this.buffer.length > 0 && diff > this.maxIntervalMs && e.key !== 'Enter') {
        this.buffer = '';
      }

      this.lastKeyTime = now;

      // Si es 'Enter', procesamos el código acumulado
      if (e.key === 'Enter') {
        const scannedCode = this.buffer.trim();
        if (scannedCode.length >= this.minBarcodeLength) {
          e.preventDefault();
          this.onScan(scannedCode);
        }
        this.buffer = '';
        return;
      }

      // Si es un caracter alfanumérico imprimible
      if (e.key.length === 1) {
        this.buffer += e.key;
      }
    };

    window.addEventListener('keydown', this.keydownHandler, true);
  }

  public stop(): void {
    if (!this.isListening || !this.keydownHandler) return;
    window.removeEventListener('keydown', this.keydownHandler, true);
    this.isListening = false;
    this.buffer = '';
  }
}
