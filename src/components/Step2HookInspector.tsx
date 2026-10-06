import React from 'react';
import { Radio, Copy, Check, Terminal, Cpu, Zap, Shield, Key } from 'lucide-react';

export const Step2HookInspector: React.FC = () => {
  const [copied, setCopied] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const hookCode = `/**
 * useBarcodeScanner.ts
 * Hook personalizado para React Native (Expo)
 * Captura códigos de barras de pistolas láser (Bluetooth / USB OTG) en modo HID
 * SIN que se abra el teclado virtual y SIN un TextInput visible en la pantalla.
 */

import { useEffect, useRef, useCallback } from 'react';
import { TextInput, NativeSyntheticEvent, TextInputKeyPressEventData, Platform } from 'react-native';

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  maxIntervalMs?: number; // Tiempo máximo entre teclas (la pistola escribe a <40ms)
  minBarcodeLength?: number;
}

export function useBarcodeScanner({
  onScan,
  maxIntervalMs = 50,
  minBarcodeLength = 3,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const inputRef = useRef<TextInput>(null);

  // Asegura que el input oculto nunca pierda el foco
  const keepFocus = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // Al montar la pantalla, enfocar inmediatamente
    const timer = setTimeout(() => {
      keepFocus();
    }, 300);

    return () => clearTimeout(timer);
  }, [keepFocus]);

  // Manejador del cambio de texto acumulado
  const handleChangeText = (text: string) => {
    // Si la pistola envía el código completo de golpe o con salto de línea
    if (text.includes('\\n') || text.includes('\\r')) {
      const clean = text.replace(/[\\n\\r]/g, '').trim();
      if (clean.length >= minBarcodeLength) {
        onScan(clean);
      }
      bufferRef.current = '';
      if (inputRef.current) {
        inputRef.current.clear();
      }
      return;
    }

    const now = Date.now();
    const diff = now - lastKeyTimeRef.current;

    // Si ha pasado demasiado tiempo, resetear (filtrar tipeo humano accidental)
    if (bufferRef.current.length > 0 && diff > maxIntervalMs) {
      bufferRef.current = '';
    }

    lastKeyTimeRef.current = now;
    bufferRef.current = text;
  };

  // Manejador de evento al presionar ENTER (la pistola siempre finaliza con Enter)
  const handleSubmitEditing = () => {
    const scanned = bufferRef.current.trim();
    if (scanned.length >= minBarcodeLength) {
      onScan(scanned);
    }
    bufferRef.current = '';
    if (inputRef.current) {
      inputRef.current.clear();
      inputRef.current.focus();
    }
  };

  return {
    inputRef,
    keepFocus,
    scannerInputProps: {
      ref: inputRef,
      value: bufferRef.current,
      onChangeText: handleChangeText,
      onSubmitEditing: handleSubmitEditing,
      // CRÍTICO PARA ANDROID: Impide que Android abra el teclado táctil virtual en pantalla
      showSoftInputOnFocus: false,
      autoFocus: true,
      blurOnSubmit: false,
      onBlur: keepFocus,
      caretHidden: true,
      keyboardType: 'default' as const,
      style: {
        position: 'absolute' as const,
        top: -100,
        left: -100,
        width: 1,
        height: 1,
        opacity: 0,
      },
    },
  };
}`;

  const nativeKeyCode = `/**
 * Solución Nativa Alternativa: react-native-keyevent
 * Para interceptar eventos directos de hardware a nivel de Sistema Operativo
 */

import KeyEvent from 'react-native-keyevent';
import { useEffect, useRef } from 'react';

export function useHardwareKeyScanner(onScan: (barcode: string) => void) {
  const barcodeBuffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    // Inicia captura global de teclas físicas en Android
    KeyEvent.onKeyDownListener((keyEvent: { keyCode: number; characters: string }) => {
      const now = Date.now();
      
      // Si la tecla es ENTER (KeyCode 66 en Android)
      if (keyEvent.keyCode === 66) {
        const code = barcodeBuffer.current.trim();
        if (code.length >= 3) {
          onScan(code);
        }
        barcodeBuffer.current = '';
        return;
      }

      // Discriminación por velocidad de tipeo (< 50ms)
      if (now - lastKeyTime.current > 50 && barcodeBuffer.current.length > 0) {
        barcodeBuffer.current = '';
      }

      lastKeyTime.current = now;
      if (keyEvent.characters) {
        barcodeBuffer.current += keyEvent.characters;
      }
    });

    return () => {
      KeyEvent.removeKeyDownListener();
    };
  }, [onScan]);
}`;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 bg-emerald-100 text-[#16a34a] rounded-2xl">
            <Radio className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="text-xs font-black text-[#16a34a] uppercase tracking-wider">
              Paso 2 de 5 · Entrada de Hardware
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900">
              Hook en React Native para Pistola Láser HID en Segundo Plano
            </h2>
          </div>
        </div>

        <p className="text-xs md:text-sm text-slate-600 leading-relaxed max-w-3xl">
          Las pistolas de códigos de barras (Bluetooth o cable OTG) operan como teclados físicos (Modo HID). Envían pulsaciones a altísima velocidad (&lt;30ms por tecla) y terminan con un código <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-emerald-800 font-bold">ENTER</code>.
        </p>

        {/* 3 Desafíos de Hardware Resueltos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-emerald-800 font-black text-xs flex items-center gap-1.5 mb-1.5 uppercase">
              <Zap className="w-4 h-4 text-[#16a34a]" />
              1. Sin Teclado en Pantalla
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Usamos la propiedad nativa de Android <code className="font-mono text-slate-800 font-bold">showSoftInputOnFocus=&#123;false&#125;</code>, garantizando que el teclado táctil de Android no se abra jamás al escanear.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-amber-800 font-black text-xs flex items-center gap-1.5 mb-1.5 uppercase">
              <Key className="w-4 h-4 text-amber-600" />
              2. Foco Permanente
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              El listener implementa una guardia <code className="font-mono text-slate-800 font-bold">onBlur=&#123;keepFocus&#125;</code> para que el vendedor pueda tocar cualquier botón y el foco vuelva a la pistola al instante.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-blue-800 font-black text-xs flex items-center gap-1.5 mb-1.5 uppercase">
              <Cpu className="w-4 h-4 text-blue-600" />
              3. Filtro de Velocidad
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Medición de tiempo entre teclas (&lt;50ms) para discriminar la pistola de un tipeo humano accidental y autocompletar en milisegundos.
            </p>
          </div>
        </div>
      </div>

      {/* Código del Hook */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xl">
        <div className="p-4 md:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-[#16a34a]" />
            <span className="font-black text-sm text-slate-800">
              Código Fuente: src/hooks/useBarcodeScanner.ts
            </span>
          </div>

          <button
            type="button"
            onClick={() => copyToClipboard(hookCode, 'hook')}
            className="px-3.5 py-1.5 bg-[#16a34a] hover:bg-[#15803d] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
          >
            {copied === 'hook' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied === 'hook' ? 'Copiado' : 'Copiar Hook'}</span>
          </button>
        </div>

        <div className="p-4 bg-slate-950 overflow-x-auto text-xs font-mono text-emerald-400 max-h-[500px]">
          <pre><code>{hookCode}</code></pre>
        </div>
      </div>
    </div>
  );
};
