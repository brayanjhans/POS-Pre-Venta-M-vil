import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, CameraOff, Flashlight, FlashlightOff, Keyboard, X } from 'lucide-react';
import type { IScannerControls } from '@zxing/browser';

/**
 * Escáner con la cámara del celular (códigos de barras de productos y QR de tickets).
 *
 * Usa el lector nativo del sistema (BarcodeDetector) cuando existe y, si no, ZXing,
 * que se carga recién al abrir la cámara para no pesar en el inicio de la app.
 * En modo continuo la cámara sigue abierta para escanear varios productos seguidos.
 */

type Kind = 'barcode' | 'qr' | 'any';

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Devuelve un texto de confirmación (ej. "✓ Coca Cola"), { error } con el motivo si el código no
   * sirvió (la cámara sigue abierta), o nada.
   */
  onDetected: (code: string) => string | { error: string } | null | void;
  kind?: Kind;
  continuous?: boolean;
  title?: string;
}

const NATIVE_FORMATS: Record<Kind, string[]> = {
  barcode: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'],
  qr: ['qr_code'],
  any: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'],
};

/** Mismo código leído dos veces seguidas dentro de este lapso = una sola lectura. */
const REPEAT_GUARD_MS = 1800;

interface NativeDetector {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}
type NativeDetectorCtor = (new (opts: { formats: string[] }) => NativeDetector) & {
  getSupportedFormats?: () => Promise<string[]>;
};

const cameraErrorMessage = (e: unknown): string => {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'La app no tiene permiso para usar la cámara. Actívelo en Ajustes → Apps → POS Pre-Venta → Permisos → Cámara.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No se encontró una cámara en este equipo.';
  if (name === 'NotReadableError') return 'La cámara está siendo usada por otra app. Ciérrela y vuelva a intentar.';
  return 'No se pudo abrir la cámara.';
};

export const CameraScanner: React.FC<Props> = ({ open, onClose, onDetected, kind = 'any', continuous = false, title }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const stopRef = React.useRef<() => void>(() => {});
  const lastRef = React.useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const onDetectedRef = React.useRef(onDetected);
  onDetectedRef.current = onDetected;
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  const [status, setStatus] = React.useState<'starting' | 'scanning' | 'error'>('starting');
  const [error, setError] = React.useState('');
  const [torchOn, setTorchOn] = React.useState(false);
  const [torchAvailable, setTorchAvailable] = React.useState(false);
  const [flash, setFlash] = React.useState<{ text: string; ok: boolean; id: number } | null>(null);
  const [manual, setManual] = React.useState('');
  const [attempt, setAttempt] = React.useState(0);

  const deliver = React.useCallback((raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const now = Date.now();
    if (lastRef.current.code === code && now - lastRef.current.at < REPEAT_GUARD_MS) return;
    lastRef.current = { code, at: now };
    navigator.vibrate?.(40);
    const result = onDetectedRef.current(code);
    const error = result === null ? `Código ${code} no reconocido` : typeof result === 'object' && result ? result.error : null;
    if (error) navigator.vibrate?.([60, 80, 60]);
    setFlash({ text: error ?? (typeof result === 'string' ? result : code), ok: !error, id: now });
    if (!continuous && !error) onCloseRef.current();
  }, [continuous]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus('starting');
    setError('');
    setTorchOn(false);

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('', 'NotFoundError');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
        setTorchAvailable(caps.torch === true);

        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play().catch(() => {});

        // 1) Lector nativo del sistema, si está disponible para estos formatos.
        const Native = (window as unknown as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
        const supported = Native?.getSupportedFormats ? await Native.getSupportedFormats().catch(() => []) : [];
        const formats = NATIVE_FORMATS[kind].filter(f => supported.includes(f));
        if (Native && formats.length > 0) {
          const detector = new Native({ formats });
          let timer = 0;
          const tick = async () => {
            if (cancelled) return;
            if (video.readyState >= 2) {
              try {
                const found = await detector.detect(video);
                if (found[0]?.rawValue) deliver(found[0].rawValue);
              } catch { /* cuadro sin código */ }
            }
            timer = window.setTimeout(tick, 120);
          };
          void tick();
          stopRef.current = () => window.clearTimeout(timer);
        } else {
          // 2) ZXing en JavaScript (se descarga solo cuando hace falta).
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
            import('@zxing/browser'),
            import('@zxing/library'),
          ]);
          if (cancelled) return;
          const hints = new Map();
          const zxFormats = {
            barcode: [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF],
            qr: [BarcodeFormat.QR_CODE],
            any: [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF, BarcodeFormat.QR_CODE],
          }[kind];
          hints.set(DecodeHintType.POSSIBLE_FORMATS, zxFormats);
          hints.set(DecodeHintType.TRY_HARDER, true);
          const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
          const controls: IScannerControls = await reader.decodeFromStream(stream, video, result => {
            if (result) deliver(result.getText());
          });
          if (cancelled) { controls.stop(); return; }
          stopRef.current = () => controls.stop();
        }
        if (!cancelled) setStatus('scanning');
      } catch (e) {
        if (cancelled) return;
        setError(cameraErrorMessage(e));
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      stopRef.current();
      stopRef.current = () => {};
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [open, kind, deliver, attempt]);

  // El aviso de lectura se oculta solo.
  React.useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), flash.ok ? 1600 : 3200);
    return () => window.clearTimeout(id);
  }, [flash]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn(!torchOn);
    } catch {
      setTorchAvailable(false);
    }
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manual.trim()) return;
    lastRef.current = { code: '', at: 0 };
    deliver(manual);
    setManual('');
  };

  const heading = title ?? (kind === 'qr' ? 'Escanear QR del ticket' : 'Escanear producto');

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          // Los toques dentro de la cámara no deben llegar a lo que está debajo (ej. cerrar el formulario).
          onClick={e => e.stopPropagation()}
          className="fixed inset-0 z-[90] flex flex-col bg-black text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Cabecera */}
          <div className="relative z-20 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 pb-6 pt-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/90"><Camera className="h-5 w-5" /></div>
              <div>
                <h2 className="text-base font-black leading-tight">{heading}</h2>
                <p className="text-xs text-white/70">{continuous ? 'Puede escanear varios seguidos' : 'Apunte la cámara al código'}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar cámara"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur hover:bg-white/25">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Video + marco de enfoque */}
          <div className="absolute inset-0">
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          </div>

          <div className="relative z-10 flex flex-1 items-center justify-center px-8">
            {status === 'error' ? (
              <div className="max-w-xs rounded-3xl bg-white/10 p-5 text-center backdrop-blur-md">
                <CameraOff className="mx-auto h-10 w-10 text-white/80" />
                <p className="mt-3 text-sm leading-relaxed">{error}</p>
                <button type="button" onClick={() => setAttempt(a => a + 1)}
                  className="mt-4 h-11 rounded-xl bg-brand-600 px-5 text-sm font-black hover:bg-brand-500">
                  Reintentar
                </button>
              </div>
            ) : (
              <div className={`relative w-full max-w-xs ${kind === 'qr' ? 'aspect-square' : 'aspect-[4/3]'}`}>
                <div className="absolute inset-0 rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
                {(['left-0 top-0 border-l-4 border-t-4 rounded-tl-3xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-3xl',
                  'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-3xl', 'right-0 bottom-0 border-r-4 border-b-4 rounded-br-3xl'] as const).map(pos => (
                  <span key={pos} className={`absolute h-10 w-10 border-brand-400 ${pos}`} />
                ))}
                {status === 'scanning' && <span className="scanner-line absolute inset-x-4 h-0.5 rounded-full bg-brand-400 shadow-[0_0_14px_2px] shadow-brand-400/70" />}
                {status === 'starting' && (
                  <p className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white/80">Abriendo cámara…</p>
                )}
              </div>
            )}
          </div>

          {/* Aviso de lectura */}
          <div className="pointer-events-none absolute inset-x-0 top-24 z-30 flex justify-center px-6">
            <AnimatePresence>
              {flash && (
                <motion.div key={flash.id} initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-black shadow-xl ${flash.ok ? 'bg-brand-600' : 'bg-red-600'}`}>
                  {flash.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Pie: linterna + código a mano */}
          <div className="relative z-20 space-y-3 bg-gradient-to-t from-black/85 to-transparent px-4 pb-6 pt-8">
            {torchAvailable && status === 'scanning' && (
              <div className="flex justify-center">
                <button type="button" onClick={() => void toggleTorch()}
                  className={`flex h-12 items-center gap-2 rounded-full px-5 text-sm font-bold backdrop-blur ${torchOn ? 'bg-amber-400 text-ink' : 'bg-white/15 text-white'}`}>
                  {torchOn ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
                  {torchOn ? 'Apagar linterna' : 'Linterna'}
                </button>
              </div>
            )}
            <form onSubmit={submitManual} className="flex gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-2xl bg-white/12 px-3 backdrop-blur">
                <Keyboard className="h-4 w-4 shrink-0 text-white/60" />
                <input value={manual} onChange={e => setManual(e.target.value)} placeholder="O escriba el código"
                  inputMode={kind === 'qr' ? 'text' : 'numeric'} autoComplete="off"
                  className="h-12 w-full bg-transparent font-mono text-base text-white placeholder:text-white/50 outline-none" />
              </div>
              <button type="submit" className="h-12 rounded-2xl bg-brand-600 px-5 text-sm font-black hover:bg-brand-500">OK</button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
