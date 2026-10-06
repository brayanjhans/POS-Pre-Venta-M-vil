# 📱 Guía para Generar el Archivo APK de Android (.apk)

Esta guía explica cómo generar el archivo instalador **APK** para instalar la aplicación en cualquier teléfono Android o terminal POS móvil de los preventistas **sin necesidad de publicarla en Google Play Store**.

---

## ⚡ Método 1: Generación en la Nube con EAS Build (Recomendado y Gratis)

Este es el método oficial de Expo. No requiere que instales Android Studio ni el SDK de Android de 15 GB en tu computadora.

### Requisitos Previos:
1. Tener Node.js instalado.
2. Crear una cuenta gratuita en [expo.dev](https://expo.dev/signup).

### Paso 1: Instalar la CLI de EAS globalmente
```bash
npm install -g eas-cli
```

### Paso 2: Iniciar sesión con tu cuenta de Expo
```bash
eas login
```

### Paso 3: Configurar el proyecto (ya tienes `eas.json` y `app.json` configurados)
```bash
# Si es la primera vez en un nuevo proyecto:
eas build:configure
```

### Paso 4: Generar el archivo APK con 1 solo comando
Ejecuta el siguiente comando en la raíz del proyecto:

```bash
eas build -p android --profile preview
```

> **¿Qué hace este comando?**
> Gracias a la configuración en `eas.json` (`"buildType": "apk"` dentro de `"preview"`), Expo compilará el código y te devolverá un **enlace directo de descarga del archivo `.apk`**, acompañado de un **Código QR** que puedes escanear con la cámara del celular Android para descargar e instalar al instante.

---

## 🛠️ Método 2: Generación Local con Android Studio / Gradle

Si prefieres compilar localmente en tu computadora con tu propio entorno Android:

### Paso 1: Precompilar el código nativo de Android
```bash
npx expo prebuild
```
Esto generará la carpeta nativa `/android` en tu proyecto con todo el código Java/Kotlin y Gradle.

### Paso 2: Compilar el APK Release
En Windows:
```bash
cd android
gradlew assembleRelease
```

En Linux / Mac:
```bash
cd android
./gradlew assembleRelease
```

### Paso 3: Ubicación del archivo APK generado
Tu archivo APK listo para instalar estará en:
```
android/app/build/outputs/apk/release/app-release.apk
```

---

## 📲 Cómo Instalar el APK en los Celulares de los Preventistas

1. Pasa el archivo `.apk` al teléfono por WhatsApp, Telegram, Google Drive o cable USB.
2. En el teléfono Android, toca el archivo descargado.
3. Si el sistema te pregunta, activa la opción **"Permitir instalar aplicaciones de fuentes desconocidas"**.
4. ¡Listo! La app se instalará con el icono de **POS Pre-Venta Golosinas** y estará lista para emparejarse con la pistola lectora Bluetooth HID y la miniticketera térmica.
