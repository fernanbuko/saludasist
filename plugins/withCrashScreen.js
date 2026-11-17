// Config plugin: añade una pantalla de arranque nativa (LaunchActivity) que, antes de iniciar React Native,
// comprueba si la última ejecución terminó por un error (Java, nativo o bloqueo) y, si es así, lo muestra
// para poder enviarlo. Usa ApplicationExitInfo (Android 11+) y el archivo que guarda withCrashLogger.
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('expo/config-plugins');

const KOTLIN = (pkg) => `package ${pkg}

import android.app.Activity
import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Detecta si la última ejecución terminó por un error. MainApplication lo consulta para arrancar en
 * "modo seguro" (sin React Native) y LaunchActivity para mostrar el informe.
 */
object CrashGate {
  private val crashReasons = setOf(
    ApplicationExitInfo.REASON_CRASH,
    ApplicationExitInfo.REASON_CRASH_NATIVE,
    ApplicationExitInfo.REASON_ANR,
    ApplicationExitInfo.REASON_INITIALIZATION_FAILURE,
  )

  fun pending(ctx: Context): Boolean = try { report(ctx) != null } catch (_: Throwable) { false }

  fun markSeen(ctx: Context) {
    val ts = if (Build.VERSION.SDK_INT >= 30) try {
      ctx.getSystemService(ActivityManager::class.java).getHistoricalProcessExitReasons(ctx.packageName, 0, 1).firstOrNull()?.timestamp ?: 0L
    } catch (_: Throwable) { 0L } else 0L
    ctx.getSharedPreferences("saludasist_crash", Context.MODE_PRIVATE).edit().putLong("seen", maxOf(ts, System.currentTimeMillis())).commit()
    File(ctx.filesDir, "last_crash.txt").delete()
  }

  fun report(ctx: Context, withTrace: Boolean = false): String? {
    val sb = StringBuilder()
    val file = File(ctx.filesDir, "last_crash.txt")
    if (file.exists()) sb.append(file.readText().take(8000))
    if (Build.VERSION.SDK_INT >= 30) {
      val am = ctx.getSystemService(ActivityManager::class.java)
      val info = am.getHistoricalProcessExitReasons(ctx.packageName, 0, 1).firstOrNull()
      val seen = ctx.getSharedPreferences("saludasist_crash", Context.MODE_PRIVATE).getLong("seen", 0L)
      if (info != null && info.timestamp > seen && info.reason in crashReasons) {
        val reason = when (info.reason) {
          ApplicationExitInfo.REASON_CRASH -> "error de Java"
          ApplicationExitInfo.REASON_CRASH_NATIVE -> "error nativo"
          ApplicationExitInfo.REASON_ANR -> "la app dejó de responder"
          else -> "fallo al iniciar"
        }
        val date = SimpleDateFormat("dd/MM HH:mm:ss", Locale.US).format(Date(info.timestamp))
        sb.append("\\n\\nÚltimo cierre: ").append(reason).append(" (").append(date).append(")\\n")
        sb.append(info.description ?: "")
        if (withTrace) try {
          info.traceInputStream?.use { s -> sb.append("\\n\\n").append(printable(s.readBytes())) }
        } catch (_: Throwable) {}
      }
    }
    val text = sb.toString().trim()
    if (text.isEmpty()) return null
    val version = try { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName } catch (_: Throwable) { "?" }
    val header = "SaludAsist ${'$'}version · Android ${'$'}{Build.VERSION.RELEASE} (API ${'$'}{Build.VERSION.SDK_INT}) · ${'$'}{Build.MANUFACTURER} ${'$'}{Build.MODEL} · ${'$'}{Build.SUPPORTED_ABIS.joinToString()}"
    return (header + "\\n\\n" + text).take(20000)
  }

  /** Extrae el texto legible de un informe binario (p. ej. el "tombstone" de un fallo nativo). */
  private fun printable(bytes: ByteArray): String {
    val out = StringBuilder()
    val cur = StringBuilder()
    for (b in bytes) {
      val c = b.toInt() and 0xff
      if (c in 32..126 || c == 10) cur.append(c.toChar()) else {
        if (cur.length >= 6) out.append(cur).append('\\n')
        cur.setLength(0)
      }
      if (out.length > 12000) break
    }
    if (cur.length >= 6) out.append(cur)
    return out.toString()
  }
}

class LaunchActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val report = try { CrashGate.report(this, withTrace = true) } catch (_: Throwable) { null }
    if (report == null) {
      openApp()
      return
    }
    showReport(report)
  }

  private fun showReport(report: String) {
    val pad = (16 * resources.displayMetrics.density).toInt()
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(pad, pad * 3, pad, pad)
      setBackgroundColor(Color.parseColor("#E9F1FA"))
    }
    root.addView(TextView(this).apply {
      text = "La app se cerró por un error"
      textSize = 22f
      setTypeface(typeface, Typeface.BOLD)
      setTextColor(Color.parseColor("#C94040"))
    })
    root.addView(TextView(this).apply {
      text = "Pulsa «Compartir error» y envíaselo a quien te instaló la app, o haz una captura de pantalla. Después pulsa «Cerrar y volver a intentar» y abre la app de nuevo."
      textSize = 15f
      setTextColor(Color.parseColor("#1C2B3D"))
      setPadding(0, pad / 2, 0, pad / 2)
    })
    val share = Button(this).apply {
      text = "Compartir error"
      setOnClickListener {
        val send = Intent(Intent.ACTION_SEND).apply {
          type = "text/plain"
          putExtra(Intent.EXTRA_SUBJECT, "Error de SaludAsist")
          putExtra(Intent.EXTRA_TEXT, report)
        }
        startActivity(Intent.createChooser(send, "Compartir error"))
      }
    }
    val open = Button(this).apply {
      text = "Cerrar y volver a intentar"
      setOnClickListener {
        // La app está en modo seguro (sin React Native): hay que reiniciar el proceso.
        CrashGate.markSeen(this@LaunchActivity)
        finishAffinity()
        android.os.Process.killProcess(android.os.Process.myPid())
      }
    }
    root.addView(share)
    root.addView(open)
    val scroll = ScrollView(this)
    scroll.addView(TextView(this).apply {
      text = report
      textSize = 11f
      typeface = Typeface.MONOSPACE
      setTextIsSelectable(true)
      setTextColor(Color.parseColor("#1C2B3D"))
      setBackgroundColor(Color.WHITE)
      setPadding(pad / 2, pad / 2, pad / 2, pad / 2)
    })
    root.addView(scroll, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
    setContentView(root)
  }

  private fun openApp() {
    val i = Intent(this, MainActivity::class.java)
    intent?.data?.let { i.data = it }
    intent?.extras?.let { i.putExtras(it) }
    startActivity(i)
    overridePendingTransition(0, 0)
    finish()
  }
}
`;

module.exports = function withCrashScreen(config) {
  config = withDangerousMod(config, [
    'android',
    async (c) => {
      const pkg = c.android?.package;
      const dir = path.join(c.modRequest.platformProjectRoot, 'app/src/main/java', ...pkg.split('.'));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'LaunchActivity.kt'), KOTLIN(pkg));
      return c;
    },
  ]);
  return withAndroidManifest(config, (c) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    const activities = app.activity ?? [];
    const isLauncher = (f) =>
      f.action?.some((a) => a.$['android:name'] === 'android.intent.action.MAIN') &&
      f.category?.some((x) => x.$['android:name'] === 'android.intent.category.LAUNCHER');
    for (const a of activities) {
      if (a.$['android:name'] === '.MainActivity') a['intent-filter'] = (a['intent-filter'] ?? []).filter((f) => !isLauncher(f));
    }
    if (!activities.some((a) => a.$['android:name'] === '.LaunchActivity')) {
      activities.unshift({
        $: {
          'android:name': '.LaunchActivity',
          'android:exported': 'true',
          'android:theme': '@style/Theme.App.SplashScreen',
          'android:screenOrientation': 'portrait',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
            category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
          },
        ],
      });
    }
    app.activity = activities;
    return c;
  });
};
