#!/usr/bin/env bash
#
# Build the webOS Dev Manager Flatpak locally, from source.
#
# This compiles the Angular frontend and the Tauri/Rust backend inside the
# Flatpak sandbox using the committed vendored sources
# (flatpak/node-sources.json, flatpak/cargo-sources.json) and produces a
# single-file bundle (flatpak/org.webosbrew.devman.flatpak).
#
# Requirements: flatpak and flatpak-builder. The GNOME 46 runtime/SDK and the
# node20 + rust-stable SDK extensions are installed automatically.
#
# If you changed package-lock.json or Cargo.lock, regenerate the vendored
# sources first with scripts/flatpak-gen-sources.sh.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FLATPAK_DIR="$REPO_ROOT/flatpak"
APP_ID="org.webosbrew.devman"
RUNTIME_VERSION="46"

echo "==> Ensuring the GNOME $RUNTIME_VERSION runtime, SDK and extensions are available"
flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak install --user --noninteractive flathub \
  "org.gnome.Platform//$RUNTIME_VERSION" \
  "org.gnome.Sdk//$RUNTIME_VERSION" \
  "org.freedesktop.Sdk.Extension.node20//23.08" \
  "org.freedesktop.Sdk.Extension.rust-stable//23.08"

echo "==> Running flatpak-builder"
cd "$FLATPAK_DIR"
flatpak-builder --user --force-clean --repo=repo build-dir "$APP_ID.yml"

echo "==> Creating bundle $FLATPAK_DIR/$APP_ID.flatpak"
flatpak build-bundle repo "$APP_ID.flatpak" "$APP_ID" \
  --runtime-repo=https://flathub.org/repo/flathub.flatpakrepo

echo "==> Done. Install it with:"
echo "    flatpak install --user $FLATPAK_DIR/$APP_ID.flatpak"
