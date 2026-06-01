#!/usr/bin/env bash
#
# Build the webOS Dev Manager Flatpak locally.
#
# This builds the Tauri Debian package, stages it next to the Flatpak manifest,
# and runs flatpak-builder to produce a single-file bundle
# (flatpak/org.webosbrew.devman.flatpak).
#
# Requirements: flatpak, flatpak-builder, and the toolchain needed to build the
# app (Node.js, Rust, and the webkit2gtk-4.1 development packages). See
# flatpak/README.md for details.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FLATPAK_DIR="$REPO_ROOT/flatpak"
APP_ID="org.webosbrew.devman"
RUNTIME_VERSION="46"

cd "$REPO_ROOT"

echo "==> Building Debian package with Tauri"
npm run build -- --features=vendored-openssl --bundles deb

deb="$(find target -path '*/bundle/deb/*.deb' -print -quit)"
if [ -z "$deb" ]; then
  echo "error: could not find a built .deb under target/**/bundle/deb/" >&2
  exit 1
fi
echo "==> Using $deb"
cp "$deb" "$FLATPAK_DIR/webos-dev-manager.deb"

echo "==> Ensuring the GNOME $RUNTIME_VERSION runtime is available"
flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak install --user --noninteractive flathub \
  "org.gnome.Platform//$RUNTIME_VERSION" "org.gnome.Sdk//$RUNTIME_VERSION"

echo "==> Running flatpak-builder"
cd "$FLATPAK_DIR"
flatpak-builder --user --force-clean --repo=repo build-dir "$APP_ID.yml"

echo "==> Creating bundle $FLATPAK_DIR/$APP_ID.flatpak"
flatpak build-bundle repo "$APP_ID.flatpak" "$APP_ID" \
  --runtime-repo=https://flathub.org/repo/flathub.flatpakrepo

echo "==> Done. Install it with:"
echo "    flatpak install --user $FLATPAK_DIR/$APP_ID.flatpak"
