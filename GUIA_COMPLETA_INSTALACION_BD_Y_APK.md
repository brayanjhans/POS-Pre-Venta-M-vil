# 📖 GUÍA MAESTRA PASO A PASO: CREACIÓN DE BASE DE DATOS Y GENERACIÓN DE APK ANDROID
### Sistema de POS Pre-Venta & Toma de Pedidos para Golosinas y Bebidas

Esta guía contiene todos los pasos detallados, comandos exactos y explicaciones necesarias para:
1. **Crear y desplegar la Base de Datos** (PostgreSQL en el servidor central y SQLite en el móvil).
2. **Generar el archivo instalador APK de Android (.apk)** para los teléfonos de los preventistas.
3. **Hacer Commit y sincronizar todo con GitHub**.

---

## 📑 ÍNDICE
- [PARTE 1: Cómo Crear la Base de Datos](#parte-1-cómo-crear-la-base-de-datos)
  - [Opción 1.1: PostgreSQL en la Nube (Supabase / Neon / Cloud SQL / Docker)](#opción-11-postgresql-servidor-central)
  - [Opción 1.2: Base de Datos SQLite Local Offline en React Native](#opción-12-sqlite-local-en-el-móvil-android)
  - [Comprobación del Funcionamiento del Trigger de Stock](#comprobación-del-trigger-de-descuento-de-stock)
- [PARTE 2: Cómo Generar el Archivo APK de Android (.apk)](#parte-2-cómo-generar-el-archivo-apk-de-android-apk)
  - [Paso 2.1: Requisitos Previos](#paso-21-requisitos-previos)
  - [Paso 2.2: Generación en la Nube con EAS Build (Recomendado y Gratis)](#paso-22-generación-del-apk-con-eas-build)
  - [Paso 2.3: Instalación del APK en los Celulares de los Preventistas](#paso-23-instalación-del-apk-en-el-celular-android)
  - [Paso 2.4: Compilación Local Alternativa (con Android Studio / Gradle)](#paso-24-compilación-local-con-gradle)
- [PARTE 3: Comandos de Git para Guardar y Subir a GitHub](#parte-3-comandos-de-git-para-hacer-commit)

---

# PARTE 1: CÓMO CREAR LA BASE DE DATOS

El sistema utiliza una arquitectura especializada para confitería y bebidas:
* **El inventario siempre se mide en la Unidad Base Mínima** (botellas de gaseosa, barras de chocolate, chupetines sueltos).
* **Maneja Precios Independientes** para Unidad, Medio Paquete y Paquete Completo (con descuentos por volumen).
* **Trigger automático de despacho:** Descuenta stock únicamente cuando la Caja Principal cobra el pedido con el código QR.

---

### Opción 1.1: PostgreSQL (Servidor Central)

Puedes usar **Supabase** (gratis), **Neon.tech**, **PostgreSQL local** o un contenedor **Docker**.

#### Método Rápido A: Vía Supabase o Neon (Interfaz Web con 1 Clic)
1. Entra a [supabase.com](https://supabase.com) o [neon.tech](https://neon.tech) y crea un nuevo proyecto gratuito.
2. En el menú lateral izquierdo, haz clic en **SQL Editor** (Editor SQL).
3. Haz clic en **New query** (Nueva consulta).
4. Abre el archivo de este proyecto: `database/schema_postgresql.sql`, copia todo su contenido y pégalo en el editor.
5. Haz clic en **RUN** (Ejecutar).
   > *Resultado: Se crearán las 6 tablas (`products`, `product_presentations`, `customers`, `sellers`, `orders`, `order_items`), los índices de velocidad y el Trigger `trg_deduct_inventory_on_order_payment`.*
6. Abre el archivo `database/seed_candy_beverages.sql`, copia su contenido, pégalo en el editor y haz clic en **RUN**.
   > *Resultado: Se insertarán las categorías, clientes de prueba, preventistas y productos reales (Inka Kola, Sublime, Oreo, Bon Bon Bum).*

---

#### Método Rápido B: Vía Terminal con `psql` o Docker
Si tienes PostgreSQL instalado localmente o usas Docker:

```bash
# 1. (Opcional) Levantar un contenedor PostgreSQL con Docker
docker run --name pos-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pos_golosinas -p 5432:5432 -d postgres:16

# 2. Ejecutar el script de creación de tablas y triggers
psql -h localhost -U postgres -d pos_golosinas -f database/schema_postgresql.sql

# 3. Ejecutar los datos de prueba (Seed Data)
psql -h localhost -U postgres -d pos_golosinas -f database/seed_candy_beverages.sql
```

---

### Opción 1.2: SQLite Local en el Móvil Android (Offline)

El archivo `database/schema_sqlite_mobile.sql` está optimizado para la librería nativa `expo-sqlite` en React Native.

#### Cómo se inicializa en el código de la app móvil:
En tu proyecto React Native con Expo, añade este servicio de inicio:

```typescript
// src/services/database.ts
import * as SQLite from 'expo-sqlite';

export async function initLocalDatabase() {
  const db = await SQLite.openDatabaseAsync('pos_golosinas_offline.db');

  // Ejecutar DDL para SQLite
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    
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
      FOREIGN KEY (product_id) REFERENCES local_products(id)
    );

    CREATE TABLE IF NOT EXISTS local_orders (
      id TEXT PRIMARY KEY,
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
      FOREIGN KEY (order_id) REFERENCES local_orders(id)
    );

    CREATE INDEX IF NOT EXISTS idx_local_products_barcode ON local_products(barcode);
  `);

  console.log('✓ Base de datos SQLite offline inicializada');
  return db;
}
```

---

### Comprobación del Trigger de Descuento de Stock

Para verificar que la base de datos descuenta stock automáticamente al cobrar:

```sql
-- 1. Consultar stock antes de pagar (Inka Kola tiene 240 botellas base)
SELECT name, stock_in_base_units FROM products WHERE id = 'prod_001';

-- 2. Simular que el Cajero cobra el pedido en la Caja Mostrador
UPDATE orders 
SET status = 'PAGADO', 
    payment_method = 'Efectivo', 
    paid_at = CURRENT_TIMESTAMP 
WHERE id = 'PED-00891';

-- 3. Consultar stock después de pagar:
-- El pedido PED-00891 tenía 2 fardos de 12 botellas = 24 botellas.
-- El stock ahora será exactamente: 240 - 24 = 216 botellas.
SELECT name, stock_in_base_units FROM products WHERE id = 'prod_001';
```

---

# PARTE 2: CÓMO GENERAR EL ARCHIVO APK DE ANDROID (.apk)

Un archivo `.apk` es el instalador estándar para dispositivos Android. No necesitas subir la aplicación a Google Play Store para que tus vendedores la utilicen.

---

### Paso 2.1: Requisitos Previos
1. Tener **Node.js** instalado (versión 18 o superior). Verifica con `node -v`.
2. Crear una cuenta gratuita en [expo.dev/signup](https://expo.dev/signup).

---

### Paso 2.2: Generación del APK con EAS Build (Método en la Nube - Recomendado)

Este método compila la aplicación en los servidores de Expo en la nube, por lo que **no necesitas instalar Android Studio ni descargar los 15 GB del Android SDK**.

Ya hemos configurado en el proyecto los 2 archivos necesarios:
* **`app.json`:** Define el paquete nativo `com.preventa.golosinas`, nombre y permisos (`BLUETOOTH`, `CAMERA`, etc.).
* **`eas.json`:** Configura el perfil `"preview"` con `"buildType": "apk"`.

#### Ejecuta estos 3 comandos en tu terminal:

```bash
# 1. Instalar la herramienta oficial EAS CLI globalmente
npm install -g eas-cli

# 2. Iniciar sesión con tu cuenta de Expo
eas login
# (Ingresa tu usuario y contraseña de expo.dev)

# 3. Lanzar la compilación del APK con 1 solo comando:
eas build -p android --profile preview
```

#### ¿Qué ocurrirá durante la compilación?
1. La terminal te preguntará: *`Generate a new Android Keystore?`* -> Presiona **Enter (Yes)** para que Expo genere automáticamente la firma digital.
2. Expo subirá el código y comenzará a compilar en sus servidores.
3. Al terminar (~5 a 8 minutos), la terminal te mostrará:
   * **Enlace directo de descarga (.apk):** Ejemplo `https://expo.dev/artifacts/eas/.../app-preview.apk`
   * **Código QR en la terminal:** Puedes apuntar la cámara de tu celular Android al QR y el archivo `.apk` comenzará a descargarse de inmediato.

---

### Paso 2.3: Instalación del APK en el Celular Android

1. Descarga el archivo `.apk` en el celular (o pásalo por WhatsApp / cable USB / Telegram).
2. Toca el archivo descargado en el teléfono.
3. Si Android muestra una advertencia de seguridad, selecciona:
   * **"Configuración"** -> Activa el switch **"Permitir la instalación de aplicaciones desconocidas"**.
   * Regresa y presiona **"Instalar"**.
4. ¡Listo! La app aparecerá en el menú de aplicaciones con el nombre **"POS Pre-Venta Golosinas"**.

---

### Paso 2.4: Compilación Local con Gradle (Alternativa si tienes Android Studio)

Si prefieres compilar sin conexión a internet directamente en tu computadora:

```bash
# 1. Generar la carpeta nativa de Android
npx expo prebuild

# 2. Compilar el APK Release
# En Windows:
cd android && gradlew assembleRelease

# En Mac / Linux:
cd android && ./gradlew assembleRelease

# 3. Ubicación del archivo APK generado:
# android/app/build/outputs/apk/release/app-release.apk
```

---

# PARTE 3: COMANDOS DE GIT PARA HACER COMMIT

Para guardar tus cambios y subir todo el proyecto a GitHub o GitLab:

```bash
# 1. Inicializar Git en el proyecto
git init
git branch -M main

# 2. Configurar tu autor
git config user.name "Tu Nombre"
git config user.email "tu_email@ejemplo.com"

# 3. Comprobar los archivos modificados
git status

# 4. Agregar todos los archivos al staging
git add .

# 5. Guardar el Commit con mensaje semántico
git commit -m "feat: implementar arquitectura pos preventa, esquemas de bd y configuracion de apk"

# 6. Conectar tu repositorio remoto de GitHub
# (Crea un repositorio vacío en github.com y copia su URL)
git remote add origin https://github.com/tu-usuario/pos-preventa-golosinas.git

# 7. Subir a GitHub
git push -u origin main
```

---

## 📌 RESUMEN DE ARCHIVOS CLAVE EN EL PROYECTO

| Archivo | Propósito |
| :--- | :--- |
| `database/schema_postgresql.sql` | Script SQL completo con tablas, constraints, vistas y triggers de stock. |
| `database/schema_sqlite_mobile.sql` | Esquema SQLite para persistencia offline en el celular Android. |
| `database/seed_candy_beverages.sql` | Datos de prueba con golosinas, gaseosas, unidades y fardos. |
| `app.json` | Configuración de Expo para la app Android y permisos de hardware. |
| `eas.json` | Configuración de EAS Build con `"buildType": "apk"` para generar el instalador directo. |
| `GUIA_COMPLETA_INSTALACION_BD_Y_APK.md` | Este manual detallado paso a paso. |
