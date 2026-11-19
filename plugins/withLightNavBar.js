// Config plugin: botones de la barra de navegación del sistema (◁ ○ □) siempre oscuros.
// La app usa fondos claros; sin esto, con el teléfono en modo oscuro, Android los pinta blancos sobre la barra blanca y no se ven.
const { withAndroidStyles } = require('expo/config-plugins');

module.exports = function withLightNavBar(config) {
  return withAndroidStyles(config, (cfg) => {
    const app = cfg.modResults.resources.style.find((s) => s.$.name === 'AppTheme');
    if (app) {
      app.item = app.item.filter((i) => i.$.name !== 'android:windowLightNavigationBar');
      app.item.push({ $: { name: 'android:windowLightNavigationBar', 'tools:targetApi': '27' }, _: 'true' });
    }
    return cfg;
  });
};
