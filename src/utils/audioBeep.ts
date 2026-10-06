/**
 * Sintetizador de Sonido de Escáner Láser de Código de Barras
 * Utiliza Web Audio API para reproducir el clásico bip de 1800Hz (Zebra / Honeywell)
 * sin requerir dependencias ni archivos de audio externos.
 */

let audioContext: AudioContext | null = null;
let isSoundEnabled = true;

export function setScannerSoundEnabled(enabled: boolean) {
  isSoundEnabled = enabled;
}

export function isScannerSoundActive(): boolean {
  return isSoundEnabled;
}

export function playBarcodeBeep() {
  if (!isSoundEnabled) return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioContext || audioContext.state === 'suspended') {
      audioContext = new AudioCtx();
    }

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'sine';
    // Frecuencia característica de pistola lectora comercial
    osc.frequency.setValueAtTime(1850, audioContext.currentTime);

    // Envolvente de volumen rápida (75 milisegundos de duración)
    gain.gain.setValueAtTime(0.15, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.075);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start();
    osc.stop(audioContext.currentTime + 0.08);
  } catch (e) {
    // Silencioso si el navegador bloquea audio antes de la primera interacción
  }
}

export function playSuccessChime() {
  if (!isSoundEnabled) return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioContext) audioContext = new AudioCtx();

    const now = audioContext.currentTime;
    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc1.type = 'triangle';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc2.frequency.setValueAtTime(659.25, now + 0.08); // E5

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioContext.destination);

    osc1.start(now);
    osc1.stop(now + 0.1);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.3);
  } catch (e) {}
}
