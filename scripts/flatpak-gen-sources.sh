#!/usr/bin/env bash
# Regenerate offline Flatpak dependencies after either lockfile changes.
# Requires Python 3.11+, venv/pip, git, curl, and network access.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$REPO_ROOT/flatpak"
VENV="$(mktemp -d)"
# Pin both generators together so regeneration uses reviewed tooling.
TOOLS_REF="${FLATPAK_BUILDER_TOOLS_REF:-3d6ff6697785b52ae34db8078e0ad5188a710b1f}"
trap 'rm -rf "$VENV"' EXIT

python3 -m venv "$VENV"
"$VENV/bin/pip" install --quiet aiohttp toml tomlkit \
  "flatpak-node-generator @ git+https://github.com/flatpak/flatpak-builder-tools@${TOOLS_REF}#subdirectory=node"

curl -fsSL \
  "https://raw.githubusercontent.com/flatpak/flatpak-builder-tools/${TOOLS_REF}/cargo/flatpak-cargo-generator.py" \
  -o "$VENV/flatpak-cargo-generator.py"

# The upstream archive mode can fetch detached commits (r2d2) and retains the
# per-crate Cargo.toml normalization needed by Git workspaces (ares-cli-rs).
"$VENV/bin/python" "$VENV/flatpak-cargo-generator.py" --git-tarballs \
  "$REPO_ROOT/Cargo.lock" -o "$OUT_DIR/cargo-sources.json"

"$VENV/bin/python" -m flatpak_node_generator \
  --node-sdk-extension org.freedesktop.Sdk.Extension.node24//25.08 npm \
  "$REPO_ROOT/package-lock.json" -o "$OUT_DIR/node-sources.json"
