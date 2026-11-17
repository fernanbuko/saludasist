# SaludAsist

> **Versión 2.0.0:** inicio de sesión con Google, datos en la nube (Firebase), compartir con la familia mediante código, IA gratuita (Gemini) y aviso de actualización dentro de la app. Ver «Firebase» más abajo.

App Android para recordar la medicación de un familiar y comprobar que la ha tomado. La persona fotografía el blíster o la caja vacía y la IA (Gemini, de Google) verifica la foto. El familiar recibe un aviso de SaludAsist en su móvil cuando se confirma una toma o cuando una dosis se queda sin tomar.

## Qué hace

| Pantalla | Función |
|---|---|
| **Hoy** | Muestra la dosis que toca ahora, con los botones «Ya la tomé» y «Aún no» (posponer 10 min), y la lista de dosis del día. Tiene un botón para escuchar el recordatorio en voz alta. |
| **Validación de toma** | Abre la cámara para fotografiar el blíster o la caja vacía, y la IA verifica la foto. También se puede registrar «Sin foto» o dejar la foto para «Foto después». |
| **Medicinas** | Lista de medicamentos. Con **+** se añaden nombre, dosis, duración, frecuencia, nota, tipo (pastilla o líquido) y color. Los tratamientos terminados aparecen atenuados. |
| **Historial** | Calendario de cumplimiento (verde: todo tomado; rojo: mayoría olvidada), porcentaje de 7 y 30 días y racha de días completos. |
| **Ajustes** | Nombre de la persona, clave de la IA, avisos al cuidador y lectura en voz alta. |
| **Asistente** | Chat con la IA sobre la medicación («¿Qué me falta hoy?», «¿Cómo voy esta semana?»). |

### Duración y frecuencia
- **Duración**: «Por días» (indicas cuántos días: 3, 5, 7, 10, 14, 30 u otro número) o «De por vida». Puede empezar hoy o mañana.
- **Frecuencia**:
  - «Cada X horas» (1, 2, 3, 4, 6, 8, 12 o 24 h): indicas la hora de la primera toma y la app calcula el resto.
  - «Horas concretas»: eliges las horas y los días de la semana a mano.
- El formulario muestra las tomas calculadas, el total y la fecha de la última toma. Ejemplo: cada 8 h durante 7 días, empezando hoy a las 2:00 PM, da **21 tomas**, y la última es dentro de 7 días a las 6:00 AM.
- Solo se cuentan y se recuerdan las tomas dentro del tratamiento. Al terminar dejan de sonar los avisos, y en la pantalla Hoy se ve «Tratamiento: día 3 de 7».

### Recordatorios
- Se programan como **alarmas exactas** de Android, así que suenan aunque la app esté cerrada y el móvil en reposo.
- La notificación trae los botones **«Ya la tomé»** y **«Posponer 10 min»**.
- Si 30 minutos después la dosis sigue sin registrarse, llega un segundo aviso: «¿Ya tomaste…?».
- Si la app está abierta, el recordatorio también se lee en voz alta (se puede desactivar en Ajustes).

### Avisos al familiar
Desde la versión 2.0.0, los avisos llegan como **notificaciones de la propia SaludAsist** (ya no se usa ntfy):
1. La persona que toma la medicación crea un código en **Ajustes → Compartir con un familiar** y lo envía.
2. El familiar instala SaludAsist, entra con su cuenta de Google, elige «Soy familiar y tengo un código» y lo escribe.
3. Recibirá avisos de tomas confirmadas, fotos no verificadas y dosis con más de 1 hora sin registrar. Con la app cerrada, Android revisa cada 15-30 minutos.

### Inteligencia artificial
La verificación de fotos y el asistente usan **Gemini** (Firebase AI Logic, plan gratuito); no hace falta ninguna clave. App Check está en modo «supervisión»: Firebase lo volverá a aplicar el 21 de enero de 2027, y antes hay que publicar la app en Google Play (Play Integrity) o usar tokens de depuración.

## Instalar el APK en el móvil de tu familiar
1. Copia `SaludAsist.apk` al móvil (por cable, Drive o WhatsApp).
2. Ábrelo. Android pedirá permitir la instalación desde esa app («Orígenes desconocidos»): acéptalo.
3. Abre SaludAsist, escribe el nombre y pulsa **Comenzar**. Acepta el permiso de **notificaciones**.
4. Recomendado: en Ajustes de Android → Apps → SaludAsist → Batería, elige **Sin restricciones**. Así Android no retrasa los avisos.

## Desarrollo

Proyecto Expo (SDK 58) + React Native, con navegación de Expo Router en `src/app/`.

```bash
npm install --legacy-peer-deps
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

El APK se genera en `android/app/build/outputs/apk/release/app-release.apk`.

La optimización de código R8 está **desactivada** (`expo-build-properties` → `enableMinifyInReleaseBuilds: false` en `app.json`). Con R8 activo se eliminaba `WorkDatabase_Impl.<init>()` de WorkManager y la app se cerraba al abrirse (`NoSuchMethodException`). Si se vuelve a activar, hay que probarla en un teléfono real.

Diagnóstico incluido: si la app se cierra por un error, al volver a abrirla arranca en modo seguro y muestra el error con un botón «Compartir error» (`plugins/withCrashLogger.js` y `plugins/withCrashScreen.js`). Este APK está firmado con la clave de depuración, que basta para instalarlo a mano. Para publicarlo en Google Play hace falta una clave de firma propia (`eas build` o un keystore).

| Archivo | Contenido |
|---|---|
| `src/lib/dose.ts` | Cálculo de dosis, estados, cumplimiento y racha |
| `src/lib/notifications.ts` | Programación de recordatorios y acciones |
| `src/lib/family.ts` | Avisos al familiar (notificaciones de la app) |
| `src/lib/cloud.ts` | Datos en Firestore: perfil, medicación, invitaciones y eventos |
| `src/lib/ai.ts` | Verificación de fotos y asistente (Gemini) |
| `src/lib/background.ts` | Revisión periódica en segundo plano |
| `src/lib/store.tsx` | Estado de la app, guardado en el teléfono |

SaludAsist ayuda a recordar la medicación; no sustituye el consejo del médico o del farmacéutico.


## Firebase (versión 2)

Proyecto `saludasist-c89d5`. Archivos:

| Archivo | Para qué |
|---|---|
| `google-services.json` | Configuración del proyecto (no es secreta). |
| `firestore.rules` | Reglas de seguridad: pégalas en Firestore → Reglas → Publicar. |
| `keys/` | Clave de firma propia (**privada**, fuera del repositorio). Sin ella no se pueden publicar actualizaciones. |

Datos en Firestore: `users/{uid}`, `patients/{id}` (medicamentos, tomas y miembros), `patients/{id}/events` (avisos a la familia), `invites/{código}` y `config/app` (aviso de actualización).

### Publicar una actualización
La última versión se publica en GitHub, en la rama `descargas` de `fernanbuko/saludasist` (solo contiene `SaludAsist.apk`, `version.json` y un README; se reemplaza en cada publicación):

```bash
scripts/publicar-version.sh android/app/build/outputs/apk/release/app-release.apk "Novedades de esta versión"
```

Antes, sube `version` y `android.versionCode` en `app.json` y compila. Al abrir SaludAsist, los teléfonos con una versión anterior verán «Hay una actualización». Como respaldo, la app también lee Firestore `config/app` (`versionCode`, `versionName`, `apkUrl`, `notes`).
