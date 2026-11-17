// Config plugin: firma la versión release con la clave propia de SaludAsist (carpeta keys/, fuera del repositorio).
// Si no existe keys/keystore.properties, se usa la clave de depuración (solo para pruebas).
const { withAppBuildGradle } = require('expo/config-plugins');

const LOAD = `
// @saludasist-signing begin
def saludasistKeyProps = new Properties()
def saludasistKeyFile = rootProject.file('../keys/keystore.properties')
if (saludasistKeyFile.exists()) { saludasistKeyFile.withInputStream { saludasistKeyProps.load(it) } }
// @saludasist-signing end
`;

const RELEASE_CONFIG = `
        release {
            if (saludasistKeyFile.exists()) {
                storeFile rootProject.file('../keys/' + saludasistKeyProps['SALUDASIST_STORE_FILE'])
                storePassword saludasistKeyProps['SALUDASIST_STORE_PASSWORD']
                keyAlias saludasistKeyProps['SALUDASIST_KEY_ALIAS']
                keyPassword saludasistKeyProps['SALUDASIST_KEY_PASSWORD']
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (c) => {
    let src = c.modResults.contents;
    if (src.includes('@saludasist-signing')) return c;
    src = src.replace(/\nandroid \{/, `${LOAD}\nandroid {`);
    src = src.replace(/signingConfigs \{\n/, (m) => m + RELEASE_CONFIG + '\n');
    // En el bloque buildTypes.release, cambiar la firma de depuración por la propia.
    src = src.replace(
      /(release \{[^}]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig saludasistKeyFile.exists() ? signingConfigs.release : signingConfigs.debug',
    );
    if (!src.includes('signingConfigs.release :')) throw new Error('withReleaseSigning: no se pudo configurar la firma release');
    c.modResults.contents = src;
    return c;
  });
};
