// Config plugin: guarda en files/last_crash.txt el error de cualquier cierre inesperado de la app,
// para poder mostrarlo la próxima vez que se abra (ver src/lib/crash.ts).
const { withMainApplication } = require('expo/config-plugins');

const SNIPPET = `
    val saludasistPreviousHandler = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, error ->
      try {
        java.io.File(filesDir, "last_crash.txt").writeText(
          "Android " + android.os.Build.VERSION.RELEASE + " · " + android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL + "\\n\\n" +
            android.util.Log.getStackTraceString(error)
        )
      } catch (_: Throwable) {}
      saludasistPreviousHandler?.uncaughtException(thread, error)
    }
`;

module.exports = function withCrashLogger(config) {
  return withMainApplication(config, (c) => {
    let src = c.modResults.contents;
    if (!src.includes('last_crash.txt')) {
      const re = /override fun onCreate\(\) \{\n/;
      if (!re.test(src)) throw new Error('withCrashLogger: no se encontró onCreate() en MainApplication');
      src = src.replace(re, (m) => m + SNIPPET);
    }
    // Modo seguro: si la ejecución anterior terminó por un error, no cargar React Native
    // para que LaunchActivity pueda mostrar el informe (ver withCrashScreen.js).
    if (!src.includes('CrashGate.pending')) {
      src = src.replace(/(\n(\s*)super\.onCreate\(\)\n)/, '$1$2if (CrashGate.pending(this)) return\n');
    }
    c.modResults.contents = src;
    return c;
  });
};
