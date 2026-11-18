package expo.modules.saludasistalarm

import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings

/**
 * Pantallas propias de cada fabricante para que el sistema no cierre la app
 * («Inicio automático», «Apps protegidas», batería). Se prueban en orden; si ninguna existe, se usa la información de la app.
 */
object Oem {
  private val brand: String
    get() = ((Build.MANUFACTURER ?: "") + " " + (Build.BRAND ?: "")).lowercase()

  private fun c(pkg: String, cls: String) = Intent().setComponent(ComponentName(pkg, cls))
  private fun has(vararg names: String) = names.any { brand.contains(it) }

  fun autostartIntents(): List<Intent> = when {
    has("xiaomi", "redmi", "poco") -> listOf(
      c("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
      Intent("miui.intent.action.OP_AUTO_START").addCategory(Intent.CATEGORY_DEFAULT),
    )
    has("infinix", "tecno", "itel", "transsion") -> listOf(
      c("com.transsion.phonemaster", "com.cyin.himgr.autostart.AutoStartActivity"),
      c("com.transsion.phonemaster", "com.cyin.himgr.widget.activity.MainSettingGpActivity"),
    )
    has("honor") -> listOf(
      c("com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
      c("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
      c("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"),
    )
    has("huawei") -> listOf(
      c("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
      c("com.huawei.systemmanager", "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity"),
      c("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"),
    )
    has("oppo", "realme", "oneplus") -> listOf(
      c("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
      c("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
      c("com.oplus.safecenter", "com.oplus.safecenter.permission.startup.StartupAppListActivity"),
      c("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"),
      c("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"),
    )
    has("vivo", "iqoo") -> listOf(
      c("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
      c("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"),
      c("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"),
    )
    has("asus") -> listOf(
      c("com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity"),
      c("com.asus.mobilemanager", "com.asus.mobilemanager.entry.FunctionActivity"),
    )
    has("meizu") -> listOf(Intent("com.meizu.safe.security.SHOW_APPSEC").addCategory(Intent.CATEGORY_DEFAULT).putExtra("packageName", "com.saludasist.app"))
    has("letv", "leeco") -> listOf(c("com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"))
    has("nokia", "hmd") -> listOf(c("com.evenwell.powersaving.g3", "com.evenwell.powersaving.g3.exception.PowerSaverExceptionActivity"))
    else -> emptyList()
  }

  fun batteryIntents(pkg: String): List<Intent> {
    val details = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg"))
    return when {
      has("xiaomi", "redmi", "poco") -> listOf(
        c("com.miui.powerkeeper", "com.miui.powerkeeper.ui.HiddenAppsConfigActivity").putExtra("package_name", pkg).putExtra("package_label", "SaludAsist"),
        details,
      )
      has("samsung") -> listOf(
        c("com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity"),
        details,
      )
      has("huawei", "honor") -> listOf(
        c("com.huawei.systemmanager", "com.huawei.systemmanager.power.ui.HwPowerManagerActivity"),
        details,
      )
      else -> listOf(details)
    }
  }
}
