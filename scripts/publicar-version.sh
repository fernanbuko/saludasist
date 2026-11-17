#!/usr/bin/env bash
# Publica la versión compilada en GitHub: rama "descargas" de fernanbuko/saludasist,
# que solo contiene la última versión (SaludAsist.apk + version.json) y se reemplaza en cada publicación.
# La app lee version.json y, si hay una versión mayor que la instalada, ofrece instalar el APK.
# Uso: scripts/publicar-version.sh ruta/al.apk "Novedades de esta versión"
set -euo pipefail
REPO_DIR="${REPO_DIR:-/home/user/saludasist}"
APK="$(realpath "$1")"
NOTES="${2:-}"
cd "$(dirname "$0")/.."
NAME=$(node -p "require('./app.json').expo.version")
CODE=$(node -p "require('./app.json').expo.android.versionCode")
WORK=$(mktemp -d)
git -C "$REPO_DIR" worktree add --detach "$WORK" >/dev/null 2>&1
cd "$WORK"
git checkout --orphan descargas-nueva >/dev/null 2>&1
git rm -rf . >/dev/null 2>&1 || true
cp "$APK" SaludAsist.apk
node -e "require('fs').writeFileSync('version.json', JSON.stringify({versionCode: $CODE, versionName: '$NAME', notes: process.argv[1]}, null, 2) + '\n')" "$NOTES"
printf '# SaludAsist %s\n\nÚltima versión de la app para Android.\n\n[Descargar SaludAsist.apk](https://github.com/fernanbuko/saludasist/raw/descargas/SaludAsist.apk)\n\nNovedades: %s\n' "$NAME" "$NOTES" > README.md
git add SaludAsist.apk version.json README.md
git -c user.name="SaludAsist" -c user.email="noreply@saludasist.app" commit -q -m "SaludAsist $NAME (versionCode $CODE)"
git push -q --force origin HEAD:refs/heads/descargas
cd - >/dev/null
git -C "$REPO_DIR" worktree remove --force "$WORK"
echo "Publicada SaludAsist $NAME (versionCode $CODE) en la rama descargas"
