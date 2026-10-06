# 📦 Guía Completa de Control de Versiones: Proceso de Git Commit

Esta guía detalla el proceso estándar y profesional para inicializar el repositorio, gestionar ramas, hacer commits semánticos y subir el proyecto a **GitHub** o **GitLab**.

---

## 1. Inicialización de Git en el Proyecto

Si el proyecto aún no tiene Git inicializado, ejecuta en tu terminal:

```bash
# 1. Ubícate en la raíz del proyecto
cd pos-preventa-golosinas

# 2. Inicializa el repositorio
git init

# 3. Configura tu nombre y correo (si no lo has hecho globalmente)
git config user.name "Tu Nombre o Empresa"
git config user.email "tu_correo@ejemplo.com"

# 4. Asegura que la rama principal se llame 'main'
git branch -M main
```

---

## 2. Verificación y Preparación (.gitignore)

Verifica qué archivos están listos para entrar al control de versiones:

```bash
# Revisa el estado actual
git status
```

Asegúrate de que tu `.gitignore` ignore dependencias pesadas y variables sensibles:

```gitignore
node_modules/
.expo/
dist/
build/
*.apk
*.aab
.env
.env.local
.DS_Store
```

---

## 3. Proceso para Hacer Commit Paso a Paso

### Paso 3.1: Agregar los archivos al Área de Preparación (Staging)

```bash
# Agregar todos los cambios realizados
git add .

# O si deseas agregar archivos específicos:
git add database/
git add src/
git add app.json eas.json
```

### Paso 3.2: Realizar el Commit con Convención Semántica (Conventional Commits)

Es una buena práctica de ingeniería usar prefijos claros:
* `feat:` para nuevas características o componentes.
* `fix:` para corrección de bugs o errores.
* `refactor:` para mejoras en el código sin cambiar funcionalidad.
* `docs:` para documentación o guías.
* `chore:` para configuración de herramientas (Expo, EAS, ESLint).

Ejemplo de commits recomendados para este proyecto:

```bash
# Commit 1: Inicialización de arquitectura y esquema de base de datos
git commit -m "feat(database): agregar esquemas de postgresql y sqlite para golosinas y bebidas"

# Commit 2: Componentes móviles y pistola lectora
git commit -m "feat(mobile): implementar terminal de preventa con bottom sheet y lector hid"

# Commit 3: Caja central y tickets esc/pos con código qr
git commit -m "feat(pos): implementar modulo de caja central con escaneo qr y comprobantes termicos"

# Commit 4: Configuración de compilación de APK
git commit -m "chore(build): configurar eas.json y app.json para generacion de apk standalone"
```

O si deseas hacer un único **Commit Inicial** de todo el proyecto:

```bash
git commit -m "feat: lanzamiento inicial de POS Pre-Venta Golosinas y Bebidas con ESC/POS y QR"
```

---

## 4. Conectar con GitHub o GitLab y Subir el Proyecto

```bash
# 1. Enlaza tu repositorio remoto (reemplaza con tu URL de GitHub)
git remote add origin https://github.com/tu-usuario/pos-preventa-golosinas.git

# 2. Sube la rama 'main' por primera vez
git push -u origin main
```

---

## 5. Flujo de Trabajo Diario (Comandos Frecuentes)

Cada vez que hagas cambios en el código:

```bash
# 1. Ver qué archivos modificaste
git status

# 2. Agregar los cambios
git add .

# 3. Guardar el commit con mensaje descriptivo
git commit -m "feat(cart): agregar selector de bodega y descuento mayorista"

# 4. Enviar a GitHub
git push
```
