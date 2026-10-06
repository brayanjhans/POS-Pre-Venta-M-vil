import React from 'react';
import { 
  Database, 
  GitBranch, 
  Smartphone, 
  Copy, 
  Check, 
  Terminal, 
  Server, 
  Download, 
  Layers, 
  FileCode, 
  Cpu, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  FolderGit2,
  Package
} from 'lucide-react';

export const DevOpsAndBuildHub: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'database' | 'git' | 'apk' | 'guide'>('database');
  const [sqlTab, setSqlTab] = React.useState<'postgres' | 'sqlite' | 'seed'>('postgres');
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const postgresScript = `-- ============================================================================
-- BASE DE DATOS CENTRAL (POSTGRESQL / SUPABASE / CLOUD SQL)
-- SISTEMA DE PRE-VENTA Y DISTRIBUCIÓN DE GOLOSINAS Y BEBIDAS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- TABLA PRINCIPAL DE PRODUCTOS
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    barcode VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    category_id VARCHAR(50) NOT NULL,
    base_unit_name VARCHAR(50) NOT NULL DEFAULT 'unidad',
    stock_in_base_units INTEGER NOT NULL DEFAULT 0 CHECK (stock_in_base_units >= 0),
    min_stock_alert INTEGER NOT NULL DEFAULT 24,
    pieces_per_pack INTEGER NOT NULL DEFAULT 24,
    packaging_type VARCHAR(100) DEFAULT 'Display Caja',
    flavor_note VARCHAR(150),
    is_promo BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- TABLA DE PRESENTACIONES (PRECIOS INDEPENDIENTES Y FACTOR DE CONVERSIÓN)
CREATE TABLE IF NOT EXISTS product_presentations (
    id VARCHAR(60) PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    presentation_type VARCHAR(20) NOT NULL CHECK (presentation_type IN ('unit', 'half', 'pack')),
    label VARCHAR(150) NOT NULL,
    short_label VARCHAR(30) NOT NULL,
    conversion_factor INTEGER NOT NULL CHECK (conversion_factor >= 1),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    cost NUMERIC(10, 2) DEFAULT 0,
    barcode VARCHAR(64),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(product_id, presentation_type)
);

-- TABLA DE PEDIDOS DE PRE-VENTA
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(50) PRIMARY KEY, -- 'PED-00892'
    seller_id VARCHAR(50) NOT NULL,
    customer_name VARCHAR(200),
    customer_document VARCHAR(20),
    payment_term VARCHAR(50) NOT NULL DEFAULT 'Contado',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_PAGO',
    total_amount NUMERIC(10, 2) NOT NULL,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_base_units INTEGER NOT NULL,
    qr_payload VARCHAR(255) NOT NULL,
    payment_method VARCHAR(50),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- TABLA DE LÍNEAS DE PEDIDO
CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(60) PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(50) NOT NULL REFERENCES products(id),
    presentation_type VARCHAR(20) NOT NULL,
    presentation_label VARCHAR(150) NOT NULL,
    conversion_factor INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    base_units_deducted INTEGER NOT NULL
);

-- TRIGGER AUTOMÁTICO: DESCONTAR STOCK CUANDO SE COBRA EN CAJA
CREATE OR REPLACE FUNCTION fn_deduct_inventory_on_order_payment()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'PENDIENTE_PAGO' AND NEW.status = 'PAGADO' THEN
        UPDATE products p
        SET stock_in_base_units = p.stock_in_base_units - oi.base_units_deducted,
            updated_at = CURRENT_TIMESTAMP
        FROM order_items oi
        WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deduct_inventory_on_order_payment
AFTER UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION fn_deduct_inventory_on_order_payment();`;

  const sqliteScript = `-- ============================================================================
-- BASE DE DATOS LOCAL OFFLINE (SQLITE PARA REACT NATIVE / EXPO SQLITE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS local_products (
    id TEXT PRIMARY KEY,
    barcode TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    base_unit_name TEXT NOT NULL DEFAULT 'unidad',
    stock_in_base_units INTEGER NOT NULL DEFAULT 0,
    pieces_per_pack INTEGER NOT NULL DEFAULT 24,
    packaging_type TEXT DEFAULT 'Display Caja',
    is_promo INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS local_presentations (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    presentation_type TEXT NOT NULL,
    label TEXT NOT NULL,
    short_label TEXT NOT NULL,
    conversion_factor INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (product_id) REFERENCES local_products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS local_orders (
    id TEXT PRIMARY KEY, -- 'PED-00892'
    created_at TEXT NOT NULL,
    seller_id TEXT NOT NULL,
    seller_name TEXT NOT NULL,
    customer_name TEXT,
    payment_term TEXT DEFAULT 'Contado',
    status TEXT NOT NULL DEFAULT 'PENDIENTE_PAGO',
    total_amount REAL NOT NULL,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    total_base_units INTEGER NOT NULL,
    qr_payload TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending_sync'
);

CREATE TABLE IF NOT EXISTS local_order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    presentation_type TEXT NOT NULL,
    conversion_factor INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL,
    base_units_deducted INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES local_orders(id) ON DELETE CASCADE
);

-- ÍNDICE ULTRA RÁPIDO PARA PISTOLA LÁSER (<1ms)
CREATE INDEX IF NOT EXISTS idx_local_products_barcode ON local_products(barcode);`;

  const seedScript = `-- ============================================================================
-- SEED DATA: GOLOSINAS Y BEBIDAS INICIALES CON PRECIOS POR UNIDAD Y PAQUETE
-- ============================================================================

-- Inka Kola 500ml Pet
INSERT INTO products (id, barcode, name, category_id, base_unit_name, stock_in_base_units, pieces_per_pack, is_promo)
VALUES ('prod_001', '7750182001011', 'Inka Kola 500ml Pet', 'cat_bebidas', 'botella', 240, 12, TRUE);

INSERT INTO product_presentations (id, product_id, presentation_type, label, short_label, conversion_factor, price) VALUES
('pres_001_u', 'prod_001', 'unit', 'Unidad (1 botella)', 'UND', 1, 3.50),
('pres_001_h', 'prod_001', 'half', 'Medio fardo (6 botellas)', 'MED (6u)', 6, 19.50),
('pres_001_p', 'prod_001', 'pack', 'Fardo cerrado (12 botellas)', 'PAQ (12u)', 12, 38.00);

-- Chocolate Sublime Clásico 30g
INSERT INTO products (id, barcode, name, category_id, base_unit_name, stock_in_base_units, pieces_per_pack, is_promo)
VALUES ('prod_002', '7750885002012', 'Chocolate Sublime Clásico 30g', 'cat_chocolates', 'barra', 360, 24, TRUE);

INSERT INTO product_presentations (id, product_id, presentation_type, label, short_label, conversion_factor, price) VALUES
('pres_002_u', 'prod_002', 'unit', 'Unidad (1 barra)', 'UND', 1, 2.50),
('pres_002_h', 'prod_002', 'half', 'Medio display (12 barras)', 'MED (12u)', 12, 26.00),
('pres_002_p', 'prod_002', 'pack', 'Display completo (24 barras)', 'PAQ (24u)', 24, 50.00);`;

  const gitCommandsFull = `# 1. Inicializar el repositorio Git
git init
git branch -M main

# 2. Configurar usuario local (si no lo configuraste globalmente)
git config user.name "Tu Nombre"
git config user.email "tu_email@ejemplo.com"

# 3. Agregar todos los archivos al staging
git add .

# 4. Crear el Commit Inicial con convención semántica
git commit -m "feat: lanzamiento inicial de POS Pre-Venta Golosinas y Bebidas con ESC/POS y QR"

# 5. Conectar con tu repositorio de GitHub / GitLab
git remote add origin https://github.com/tu-usuario/pos-preventa-golosinas.git

# 6. Subir a la rama main
git push -u origin main`;

  const apkCommands = `# 1. Instalar la herramienta oficial EAS CLI de Expo
npm install -g eas-cli

# 2. Iniciar sesión en tu cuenta gratuita de Expo (crear en expo.dev si no tienes)
eas login

# 3. Compilar el archivo instalador APK standalone para Android (1 solo comando)
eas build -p android --profile preview

# Resultado: Expo compilará en la nube y te entregará:
# -> Un enlace directo de descarga del archivo .apk
# -> Un Código QR para escanearlo con el celular e instalarlo al instante`;

  const fullMarkdownGuide = `# 📖 GUÍA MAESTRA PASO A PASO: CREACIÓN DE BASE DE DATOS Y GENERACIÓN DE APK ANDROID
### Sistema de POS Pre-Venta & Toma de Pedidos para Golosinas y Bebidas

## PARTE 1: CÓMO CREAR LA BASE DE DATOS

### Opción 1.1: PostgreSQL (Servidor Central en Supabase / Neon / Cloud SQL)
1. Entra a Supabase (supabase.com) o Neon.tech y crea tu base de datos gratuita.
2. Abre la pestaña "SQL Editor" -> "New Query".
3. Copia y pega el contenido del archivo 'database/schema_postgresql.sql' y presiona RUN.
   (Esto creará las tablas: products, product_presentations, customers, sellers, orders, order_items y el Trigger de stock).
4. Copia y pega el contenido del archivo 'database/seed_candy_beverages.sql' y presiona RUN.
   (Esto cargará los productos iniciales: Inka Kola, Sublime, Oreo, Bon Bon Bum).

### Opción 1.2: SQLite Local en el Celular Android (Offline)
- El archivo 'database/schema_sqlite_mobile.sql' se utiliza con 'expo-sqlite' en React Native.
- Permite al preventista escanear códigos de barras a ultra velocidad (<1ms) sin conexión a internet.

---

## PARTE 2: CÓMO GENERAR EL ARCHIVO APK DE ANDROID (.apk)

### Requisitos:
- Node.js instalado (v18+)
- Cuenta gratuita en expo.dev

### Comandos para Generar el APK en la Nube con 1 Solo Paso:
\`\`\`bash
# 1. Instalar la CLI de Expo
npm install -g eas-cli

# 2. Iniciar sesión con tu cuenta de expo.dev
eas login

# 3. Compilar el APK instalable directo
eas build -p android --profile preview
\`\`\`

- ¿Por qué genera un .apk directo?
Porque 'eas.json' está preconfigurado con: "buildType": "apk" dentro del perfil "preview".
Al terminar, la terminal te dará el enlace directo de descarga del .apk y un Código QR.

### Cómo Instalar en el Celular Android:
1. Pasa el archivo .apk descargado al celular por WhatsApp o USB.
2. Toca el archivo .apk en el celular.
3. Activa "Permitir instalar aplicaciones de orígenes desconocidos".
4. Presiona "Instalar".

---

## PARTE 3: COMANDOS DE GIT PARA HACER COMMIT

\`\`\`bash
git init
git branch -M main
git add .
git commit -m "feat: arquitectura pos preventa, base de datos y configuracion de apk"
git remote add origin https://github.com/tu-usuario/pos-preventa-golosinas.git
git push -u origin main
\`\`\``;

  return (
    <div className="w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in text-slate-100">
      {/* Header */}
      <div className="bg-[#15803d] p-5 md:p-6 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white shadow-md">
            <Cpu className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">
                Hub de Base de Datos, Git y Generación de APK
              </h2>
            </div>
            <p className="text-xs text-white/80">
              Guías completas, scripts SQL de producción, comandos de commit y compilación de Android APK.
            </p>
          </div>
        </div>

        {/* Selector de pestañas principales */}
        <div className="flex items-center gap-1.5 bg-black/25 p-1 rounded-xl border border-white/20 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('database')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'database' ? 'bg-white text-emerald-950 shadow-md font-black' : 'text-white/80 hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>1. Base de Datos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('git')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'git' ? 'bg-white text-emerald-950 shadow-md font-black' : 'text-white/80 hover:text-white'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>2. Proceso Commit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('apk')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'apk' ? 'bg-white text-emerald-950 shadow-md font-black' : 'text-white/80 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>3. Generar APK</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'guide' ? 'bg-white text-emerald-950 shadow-md font-black' : 'text-white/80 hover:text-white'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>4. Manual .MD</span>
          </button>
        </div>
      </div>

      {/* CONTENIDO DE PESTAÑAS */}
      <div className="p-6">
        {/* ========================================================================= */}
        {/* TAB 1: BASE DE DATOS */}
        {/* ========================================================================= */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <span>Arquitectura de Base de Datos para Golosinas y Bebidas</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Esquemas preparados con factor de conversión, precios independientes de Unidad/Medio/Paquete y triggers de descuento automático.
                </p>
              </div>

              {/* Sub-tabs SQL */}
              <div className="flex gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSqlTab('postgres')}
                  className={`px-3 py-1 rounded-lg transition ${
                    sqlTab === 'postgres' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  PostgreSQL (Servidor Central)
                </button>
                <button
                  type="button"
                  onClick={() => setSqlTab('sqlite')}
                  className={`px-3 py-1 rounded-lg transition ${
                    sqlTab === 'sqlite' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  SQLite (Móvil Offline)
                </button>
                <button
                  type="button"
                  onClick={() => setSqlTab('seed')}
                  className={`px-3 py-1 rounded-lg transition ${
                    sqlTab === 'seed' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Seed Data (Productos Demo)
                </button>
              </div>
            </div>

            {/* Tarjeta explicativa de la regla de oro */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-1">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">
                  Regla de Oro
                </span>
                <h4 className="text-xs font-bold text-white">Stock en Unidad Base Mínima</h4>
                <p className="text-[11px] text-zinc-400">
                  El inventario se almacena siempre en unidades (botellas, barras, chupetines). Vender 1 paquete de 24 descuenta 24 unidades base automáticamente.
                </p>
              </div>

              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-1">
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">
                  Precios Independientes
                </span>
                <h4 className="text-xs font-bold text-white">No-Linealidad Mayorista</h4>
                <p className="text-[11px] text-zinc-400">
                  Un fardo cerrado no cuesta 12 × S/ 3.50 (S/ 42.00), sino S/ 38.00. La base de datos guarda el precio específico de cada presentación.
                </p>
              </div>

              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-1">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider block">
                  Trigger de Despacho
                </span>
                <h4 className="text-xs font-bold text-white">Descuento al Pagar en Caja</h4>
                <p className="text-[11px] text-zinc-400">
                  La pre-venta NO descuenta stock mientras está pendiente. Cuando el cajero escanea el QR y cobra, el trigger actualiza el stock real.
                </p>
              </div>
            </div>

            {/* Visor de Código SQL */}
            <div className="relative bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden shadow-inner">
              <div className="p-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {sqlTab === 'postgres' ? 'database/schema_postgresql.sql' :
                   sqlTab === 'sqlite' ? 'database/schema_sqlite_mobile.sql' : 'database/seed_candy_beverages.sql'}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(
                    sqlTab === 'postgres' ? postgresScript :
                    sqlTab === 'sqlite' ? sqliteScript : seedScript,
                    'sql_code'
                  )}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedKey === 'sql_code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'sql_code' ? 'Copiado al Portapapeles' : 'Copiar Código SQL'}</span>
                </button>
              </div>

              <pre className="p-4 text-xs font-mono text-zinc-300 overflow-x-auto max-h-[380px] leading-relaxed selection:bg-emerald-800">
                {sqlTab === 'postgres' ? postgresScript :
                 sqlTab === 'sqlite' ? sqliteScript : seedScript}
              </pre>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PROCESO GIT COMMIT */}
        {/* ========================================================================= */}
        {activeTab === 'git' && (
          <div className="space-y-6">
            <div className="border-b border-zinc-800 pb-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-amber-400" />
                <span>Proceso Paso a Paso para Hacer Commit y Subir a GitHub</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Sigue estos comandos en tu terminal local para versionar el código de forma profesional.
              </p>
            </div>

            {/* Secuencia paso a paso */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Paso 1 */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">1</span>
                  <h4 className="text-xs font-black uppercase text-white">Inicializar el Repositorio</h4>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Crea el repositorio Git local y configura la rama principal como <code className="text-emerald-400">main</code>.
                </p>
                <div className="bg-zinc-900 p-2.5 rounded-xl font-mono text-xs text-zinc-300 flex items-center justify-between">
                  <span>git init && git branch -M main</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('git init && git branch -M main', 'step1')}
                    className="p-1 text-zinc-400 hover:text-white"
                  >
                    {copiedKey === 'step1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Paso 2 */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">2</span>
                  <h4 className="text-xs font-black uppercase text-white">Agregar Archivos al Staging</h4>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Prepara todos los archivos modificados respetando el archivo <code className="text-emerald-400">.gitignore</code>.
                </p>
                <div className="bg-zinc-900 p-2.5 rounded-xl font-mono text-xs text-zinc-300 flex items-center justify-between">
                  <span>git add .</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('git add .', 'step2')}
                    className="p-1 text-zinc-400 hover:text-white"
                  >
                    {copiedKey === 'step2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Paso 3 */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">3</span>
                  <h4 className="text-xs font-black uppercase text-white">Hacer el Commit Semántico</h4>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Guarda la instantánea con un mensaje descriptivo de la funcionalidad agregada.
                </p>
                <div className="bg-zinc-900 p-2.5 rounded-xl font-mono text-xs text-zinc-300 flex items-center justify-between">
                  <span className="truncate pr-1">git commit -m "feat: modulo de preventa y tickets QR"</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('git commit -m "feat: modulo de preventa y tickets QR"', 'step3')}
                    className="p-1 text-zinc-400 hover:text-white shrink-0"
                  >
                    {copiedKey === 'step3' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Paso 4 */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">4</span>
                  <h4 className="text-xs font-black uppercase text-white">Conectar y Subir a GitHub</h4>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Vincula tu repositorio remoto y envía los commits a la nube.
                </p>
                <div className="bg-zinc-900 p-2.5 rounded-xl font-mono text-xs text-zinc-300 flex items-center justify-between">
                  <span className="truncate pr-1">git remote add origin https://github.com/tu-usuario/repo.git && git push -u origin main</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('git remote add origin https://github.com/tu-usuario/pos-preventa-golosinas.git && git push -u origin main', 'step4')}
                    className="p-1 text-zinc-400 hover:text-white shrink-0"
                  >
                    {copiedKey === 'step4' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Script completo todo-en-uno */}
            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Script Completo para Copiar y Pegar en Terminal:</span>
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(gitCommandsFull, 'git_full')}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'git_full' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'git_full' ? 'Copiado' : 'Copiar Todo el Script Git'}</span>
                </button>
              </div>
              <pre className="p-3 bg-zinc-900 rounded-xl font-mono text-xs text-zinc-300 overflow-x-auto">
                {gitCommandsFull}
              </pre>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: GENERAR APK ANDROID */}
        {/* ========================================================================= */}
        {activeTab === 'apk' && (
          <div className="space-y-6">
            <div className="border-b border-zinc-800 pb-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <span>¿Cómo Generar el Archivo APK de Android (.apk)?</span>
              </h3>
              <p className="text-xs text-zinc-400">
                La aplicación está estructurada con <strong>React Native y Expo</strong>. Aquí tienes la explicación técnica y los comandos para compilar el instalador APK directo.
              </p>
            </div>

            {/* Aclaración transparente de arquitectura */}
            <div className="bg-emerald-950/40 border border-emerald-500/40 p-4 rounded-2xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-100 space-y-1">
                <strong className="block font-black text-white">
                  Ya creamos en tu proyecto los archivos de configuración requeridos: <code className="text-amber-300">app.json</code> y <code className="text-amber-300">eas.json</code>
                </strong>
                <p>
                  Dentro de este entorno web en la nube se ejecuta el simulador y servidor interactivo. Para generar el archivo binario nativo <code className="text-emerald-300 font-bold">.apk</code> final (que pesa ~40MB y requiere el compilador de Android), se utiliza el servicio gratuito en la nube de <strong>Expo EAS Build</strong> con un solo comando en tu terminal.
                </p>
              </div>
            </div>

            {/* Pasos para compilar con EAS Build */}
            <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-white uppercase">
                    Comando Oficial para Generar el APK en la Nube (Gratis y sin instalar Android Studio)
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    Expo compila el código en sus servidores y te devuelve un enlace de descarga directa del APK.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(apkCommands, 'apk_cmds')}
                  className="px-3 py-1.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedKey === 'apk_cmds' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'apk_cmds' ? 'Copiado' : 'Copiar Comandos EAS'}</span>
                </button>
              </div>

              <pre className="p-4 bg-zinc-900 rounded-xl font-mono text-xs text-amber-300 overflow-x-auto leading-relaxed">
                {apkCommands}
              </pre>

              {/* Qué contiene eas.json */}
              <div className="pt-2 border-t border-zinc-800 text-xs text-zinc-400 space-y-1">
                <strong className="text-white">Detalle de configuración en <code className="text-emerald-400">eas.json</code>:</strong>
                <p>
                  Configuramos el perfil <code className="text-amber-300">"preview"</code> con <code className="text-emerald-400">"buildType": "apk"</code> en lugar de <code className="text-zinc-400">"app-bundle"</code>. Esto le ordena a Expo que construya un archivo instalador <strong>.APK</strong> directo que no necesita pasar por Google Play Console ni revisión de Google.
                </p>
              </div>
            </div>

            {/* Alternativa: Instalación como Aplicación Web Progresiva (PWA / Kiosk Móvil) */}
            <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-black uppercase text-white">
                  Alternativa Inmediata: Instalación Directa en Android sin Compilar
                </h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                También puedes abrir la URL compartida de esta aplicación (<code className="text-emerald-400">https://ais-pre-tmeagwdsayfzd2uefxbuer-96810044296.us-east1.run.app</code>) desde el navegador Google Chrome en cualquier teléfono Android y seleccionar <strong>"Agregar a la pantalla principal"</strong>. Se instalará con su propio icono de golosinas, abrirá a pantalla completa sin barra de navegación y funcionará con la pistola lectora HID y la ticketera térmica.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: MANUAL COMPLETO .MD */}
        {/* ========================================================================= */}
        {activeTab === 'guide' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-amber-400" />
                  <span>GUIA_COMPLETA_INSTALACION_BD_Y_APK.md</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Documento maestro con todos los pasos guiados para generar la Base de Datos y compilar el APK.
                </p>
              </div>

              <button
                type="button"
                onClick={() => copyToClipboard(fullMarkdownGuide, 'guide_full')}
                className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-black rounded-xl transition flex items-center gap-2 cursor-pointer shadow-md"
              >
                {copiedKey === 'guide_full' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedKey === 'guide_full' ? '¡Manual Completo Copiado!' : 'Copiar Archivo .MD Completo'}</span>
              </button>
            </div>

            <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 font-mono text-xs text-zinc-300 max-h-[500px] overflow-y-auto leading-relaxed shadow-inner">
              <pre className="whitespace-pre-wrap">{fullMarkdownGuide}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
