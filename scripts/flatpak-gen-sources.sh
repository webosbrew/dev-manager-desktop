#!/usr/bin/env bash
#
# Regenerate the vendored Flatpak dependency sources from the lockfiles.
#
# Run this whenever package-lock.json or Cargo.lock change. It writes:
#   flatpak/node-sources.json   (npm dependencies)
#   flatpak/cargo-sources.json  (cargo dependencies, incl. git crates)
#
# Requirements: python3 (3.11+), pip, git, and network access (the generators
# download dependency archives to hash them). node_modules must NOT be present
# for the npm generator, so it is run against package-lock.json only.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$REPO_ROOT/flatpak"
VENV="$(mktemp -d)"
TOOLS_REF="${FLATPAK_BUILDER_TOOLS_REF:-master}"

cleanup() { rm -rf "$VENV"; }
trap cleanup EXIT

echo "==> Setting up generator tools in $VENV"
python3 -m venv "$VENV"
"$VENV/bin/pip" install --quiet --upgrade pip
"$VENV/bin/pip" install --quiet aiohttp toml tomlkit \
  "flatpak-node-generator @ git+https://github.com/flatpak/flatpak-builder-tools@${TOOLS_REF}#subdirectory=node"

curl -fsSL \
  "https://raw.githubusercontent.com/flatpak/flatpak-builder-tools/${TOOLS_REF}/cargo/flatpak-cargo-generator.py" \
  -o "$VENV/flatpak-cargo-generator.py"

echo "==> Generating cargo-sources.json"
"$VENV/bin/python" "$VENV/flatpak-cargo-generator.py" \
  "$REPO_ROOT/Cargo.lock" -o "$OUT_DIR/cargo-sources.json"

echo "==> Generating node-sources.json"
"$VENV/bin/flatpak-node-generator" npm \
  "$REPO_ROOT/package-lock.json" -o "$OUT_DIR/node-sources.json"

echo "==> Done:"
ls -la "$OUT_DIR/cargo-sources.json" "$OUT_DIR/node-sources.json"
