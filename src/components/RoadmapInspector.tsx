import React from 'react';
import { 
  Database, 
  Radio, 
  Layers, 
  Printer, 
  Smartphone, 
  Terminal, 
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface Props {
  onSelectStep: (stepNumber: number) => void;
}

export const RoadmapInspector: React.FC<Props> = ({ onSelectStep }) => {
  const steps = [
    {
      num: 1,
      title: 'Paso 1: Diseño del Esquema JSON / BD & Factor de Conversión',
      desc: 'Modelado relacional y NoSQL para golosinas y bebidas con precios independientes por Unidad, Medio y Paquete, y factor de conversión matemático hacia la unidad base para descontar stock sin descuadres.',
      status: 'active',
      badge: 'ENTREGADO · EN REVISIÓN',
      icon: <Database className="w-5 h-5 text-amber-400" />,
    },
    {
      num: 2,
      title: 'Paso 2: Hook & Listener Global para Pistola Láser HID',
      desc: 'Captura de eventos de hardware de teclado Bluetooth/OTG sin requerir <TextInput> visible en pantalla, con discriminación de velocidad (inter-keystroke < 50ms) y autocompletado en segundo plano.',
      status: 'pending',
      badge: 'SIGUIENTE PASO',
      icon: <Radio className="w-5 h-5 text-rose-400" />,
    },
    {
      num: 3,
      title: 'Paso 3: Componente de Carrito y Bottom Sheet con NativeWind',
      desc: 'Lista reactiva optimizada para una sola mano en campo y modal deslizable desde abajo para alternar entre Unidad, Medio y Paquete recalculando subtotales y unidades base instantáneamente.',
      status: 'pending',
      badge: 'ESPERANDO CONFIRMACIÓN',
      icon: <Layers className="w-5 h-5 text-yellow-400" />,
    },
    {
      num: 4,
      title: 'Paso 4: Generación de Ticket Térmico ESC/POS y Código QR',
      desc: 'Flujo binario para impresoras Bluetooth de 58mm y 80mm con comandos ESC/POS, generación de Código QR obligatorio con el ID PED-XXXXX para escaneo en Caja y share digital para WhatsApp.',
      status: 'pending',
      badge: 'ESPERANDO CONFIRMACIÓN',
      icon: <Printer className="w-5 h-5 text-amber-300" />,
    },
    {
      num: 5,
      title: 'Paso 5: Persistencia Offline Local con SQLite en Expo',
      desc: 'Almacenamiento de catálogo local e inserción de pre-ventas en cola offline cuando no hay cobertura WiFi/4G, con sincronización automática hacia FastAPI al recuperar la conexión.',
      status: 'pending',
      badge: 'ESPERANDO CONFIRMACIÓN',
      icon: <Smartphone className="w-5 h-5 text-emerald-400" />,
    },
  ];

  return (
    <div className="bg-stone-900/90 rounded-3xl border border-stone-800 p-6 md:p-8 shadow-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-stone-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
              Plan de Ejecución Arquitectónico
            </span>
          </div>
          <h2 className="text-xl font-black text-amber-50 mt-1 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-amber-400" />
            Hoja de Ruta: 5 Pasos de Desarrollo
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Desarrollo guiado y modular para app Android de Golosinas y Bebidas
          </p>
        </div>

        <span className="text-xs px-3 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-full font-bold">
          Paso 1 Entregado
        </span>
      </div>

      <div className="space-y-3">
        {steps.map((st) => (
          <div
            key={st.num}
            onClick={() => onSelectStep(st.num)}
            className={`p-4 md:p-5 rounded-2xl border transition cursor-pointer flex items-start gap-4 ${
              st.status === 'active'
                ? 'bg-stone-950 border-amber-500/60 shadow-xl shadow-amber-950/40 ring-1 ring-amber-500/30'
                : 'bg-stone-950/60 border-stone-800/80 hover:border-stone-700 hover:bg-stone-950'
            }`}
          >
            <div className={`p-3 rounded-xl shrink-0 ${
              st.status === 'active' ? 'bg-amber-500/20 text-amber-300' : 'bg-stone-800 text-stone-400'
            }`}>
              {st.icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-black text-stone-100 flex items-center gap-2">
                  <span>{st.title}</span>
                </h3>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                  st.status === 'active' 
                    ? 'bg-amber-400 text-stone-950' 
                    : 'bg-stone-800 text-stone-400'
                }`}>
                  {st.badge}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">
                {st.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 text-xs text-stone-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Confirmando la revisión del <strong>Paso 1</strong>, presentaremos de inmediato el <strong>Paso 2</strong> (Hook/Listener nativo para la pistola láser HID).</span>
        </div>
      </div>
    </div>
  );
};
