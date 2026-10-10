# POS Pre-Venta (Android)

App de pre-venta y caja para distribuidoras de golosinas y bebidas. Es una app web (React + Vite)
empaquetada como APK de Android con **Capacitor**. Los datos viven en **Supabase** (PostgreSQL).

| Rol | Pantalla | Qué hace |
|---|---|---|
| Vendedor | Pre-Venta | Arma pedidos, imprime ticket con QR. Contado = cobra en el acto; Fiado = deuda del cliente; Crédito = lo cobra la caja. Funciona **sin internet**. |
| Cajero(a) | Caja | Escanea el QR, cobra (efectivo/Yape/tarjeta/mixto), fía saldos, recibe abonos, cierra turno. |
| Admin | Admin (+ puede ver Pre-Venta y Caja) | Productos, stock, promos, clientes, deudas, boletas, **usuarios** y configuración. |

---

## 1. Configurar la base de datos (una sola vez)

1. Abrir el proyecto en Supabase → **SQL Editor** → *New query*.
2. Pegar todo `supabase/migrations/20261009000000_init.sql` → **Run**.
3. Nueva query: pegar `supabase/seed.sql` → **Run** (crea el admin, clientes y catálogo de ejemplo).
   Luego, en orden, cada migración nueva de `supabase/migrations/` (`20261010000000_precio_editable.sql`, `20261010010000_libreta_fiados.sql`, `20261010020000_pin_inmutable.sql`, `20261010030000_admin_soporte.sql`, `20261010050000_reportes.sql`, `20261010060000_catalogo_maestro.sql` (categorías libres y productos conocidos), `20261010070000_fotos_productos.sql` (fotos livianas de productos), `20261010080000_fotos_combos.sql` (foto de los combos), `20261010040000_ocultar_lista_usuarios.sql` (esta última solo después de actualizar el APK en todos los celulares), …) → **Run**.
4. Ir a **Project Settings → API Keys** y copiar la clave **anon / publishable**.

Primer ingreso: usuario **`admin`**, PIN temporal **`2580`**. La app obliga a cambiarlo (es el único PIN que se puede cambiar).
Luego, desde **Admin → Usuarios**, crear a los vendedores y cajeros con su PIN. Nadie puede cambiar su propio PIN;
si alguien lo olvida, el admin usa **Restablecer PIN** (conserva la cuenta y su historial).

### Cuenta de soporte técnico (la maneja el desarrollador, no el cliente)

Sirve para recuperar el sistema si el administrador del cliente olvida su PIN. Se entra como
cualquier usuario: escribiendo `soporte` y su PIN en el login (el login no muestra la lista de
usuarios, y el celular no recuerda esta cuenta). El cliente la ve en Usuarios como *protegida* y no
puede editarla, desactivarla ni cambiar su PIN.

Crearla una sola vez en **SQL Editor**, reemplazando `TU_PIN` por un PIN de 4-6 dígitos que solo usted
conozca (no lo guarde en este repositorio):

```sql
insert into pos.users (username, full_name, role, pin_hash, is_support)
values ('soporte', 'Soporte técnico', 'admin', extensions.crypt('TU_PIN', extensions.gen_salt('bf', 8)), true);
```

Si el admin del cliente olvida su PIN: entre con la cuenta de soporte → **Admin → Usuarios → Restablecer PIN**.
Si olvida también el de soporte: en SQL Editor,
`update pos.users set pin_hash = extensions.crypt('NUEVO_PIN', extensions.gen_salt('bf', 8)), failed_attempts = 0, locked_until = null where username = 'soporte';`

> Nunca ponga la clave `service_role` / `secret` en la app ni en GitHub Actions: la app solo necesita la anon key.

## 2. Desarrollo local

```bash
cp .env.example .env      # completar VITE_SUPABASE_ANON_KEY
npm install
npm run dev               # http://localhost:3000
npm test                  # pruebas de lógica (totales, crédito, sincronización)
npm run lint              # chequeo de tipos
```

## 3. Generar el APK (GitHub Actions)

En GitHub → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Obligatorio | Valor |
|---|---|---|
| `VITE_SUPABASE_URL` | Sí | `https://edfekwyidzpdujhbndln.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Sí | la anon/publishable key |
| `ANDROID_KEYSTORE_BASE64` | Recomendado | keystore en base64 (ver abajo) |
| `ANDROID_KEYSTORE_PASSWORD` | con keystore | contraseña del keystore |
| `ANDROID_KEY_ALIAS` | con keystore | alias de la llave |
| `ANDROID_KEY_PASSWORD` | con keystore | contraseña de la llave |

Cada push a `main` compila; el APK queda en la pestaña **Actions → (ejecución) → Artifacts**.
Sin keystore se genera un APK *debug* (sirve para pruebas).

**Crear el keystore (una sola vez, guárdelo en un lugar seguro: si se pierde no podrá actualizar la app instalada):**

```bash
keytool -genkey -v -keystore pos-release.keystore -alias pos -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 pos-release.keystore    # copiar la salida al secret ANDROID_KEYSTORE_BASE64
```

## 4. Cómo funciona sin internet (sincronización)

```
 Celular del vendedor                                  Supabase
 ┌───────────────────────────────┐                ┌───────────────────────┐
 │ Catálogo en caché (productos, │ ◄── descarga ──│ pos_catalog()          │
 │ precios, clientes, deudas)    │   cada 2 min   │                        │
 │                               │                │                        │
 │ Emitir ticket ─► COLA (outbox)│ ── envía ────► │ pos_order_create()     │
 │   · UUID generado en el celular│  al reconectar │  · idempotente por UUID│
 │   · código QR impreso al toque │  (cada 15 s)   │  · precios y stock     │
 │   · stock descontado localmente│                │    calculados aquí     │
 └───────────────────────────────┘                └───────────────────────┘
```

- La **caché y la cola** se guardan con `@capacitor/preferences` (almacenamiento nativo de Android, no se
  borra como el `localStorage` del WebView).
- Cada pedido tiene un UUID creado en el celular: si se reenvía (señal intermitente), el servidor lo reconoce
  y **no lo duplica**.
- Si el servidor rechaza un pedido offline (ej. el cliente superó su límite de crédito mientras tanto),
  queda marcado en rojo en la barra superior para **Reintentar** o **Descartar**.
- **Caja, abonos y administración requieren conexión**: mueven dinero y deben validarse en el servidor.
- ¿Y SQLite? No es necesario con el volumen actual (cientos de productos). Si el catálogo crece a miles de
  productos o se necesitan búsquedas/reportes offline, se puede cambiar el almacenamiento de
  `src/services/storage.ts` por `@capacitor-community/sqlite` sin tocar la lógica de sincronización.

## 5. Seguridad (resumen)

- Tablas en el esquema `pos`, **no expuesto** por la API; RLS activado sin políticas.
- La app solo llama a funciones `public.pos_*`; cada una valida token de sesión + rol.
- PIN con bcrypt; bloqueo de 5 min tras 5 intentos fallidos; sesiones de 12 h revocables
  (al desactivar un usuario o restablecer su PIN se cierran sus sesiones).
- Precios, totales, stock y límite de crédito se calculan en el servidor, no en el celular.
- Auditoría en `pos.audit_log` (usuarios, anulaciones, abonos, configuración).

## Estructura

```
src/
  app/          barra de estado común (usuario, conexión, cola, cierre de turno)
  domain/       reglas puras y probadas: totales, crédito, códigos de ticket
  services/     rpc.ts (Supabase), api.ts (funciones), outbox.ts (cola offline), storage.ts
  state/        PosContext: sesión, catálogo, pedidos y sincronización
  features/     auth · shift · preventa · caja · admin · shared
  lib/          escáner HID, sonidos, ESC/POS, escape de HTML
supabase/
  migrations/   esquema + funciones (fuente de verdad del backend)
  seed.sql      datos iniciales
```

## Pendiente (siguientes pasos)

- Escaneo con la **cámara** del celular: `@capacitor-mlkit/barcode-scanning`.
- Impresión **Bluetooth ESC/POS**: `src/lib/escpos.ts` ya genera los bytes; falta el plugin de envío.
- Comprobantes electrónicos SUNAT (boleta/factura) si se requieren.
