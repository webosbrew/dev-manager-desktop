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

# flatpak-builder can only check out git crate commits that are reachable from a
# ref. Some pinned revisions (e.g. the r2d2 fork) are dangling commits, so we
# replace GitHub "git" sources with the equivalent by-commit archive tarball,
# which flatpak-builder fetches reliably.
echo "==> Converting GitHub git crate sources to archives"
"$VENV/bin/python" - "$OUT_DIR/cargo-sources.json" <<'PY'
import hashlib, json, re, sys, urllib.request

path = sys.argv[1]
sources = json.load(open(path))

# Map each git checkout dest -> the cargo/vendor target the shell step copies to.
cp_re = re.compile(r'"([^"]+)/\." "([^"]+)"')
git_dest_to_target = {}
shell_idx_to_drop = set()
for i, e in enumerate(sources):
    if e.get("type") == "shell":
        for cmd in e.get("commands", []):
            m = cp_re.search(cmd)
            if m:
                git_dest_to_target[m.group(1)] = m.group(2)
                shell_idx_to_drop.add(i)

out = []
for i, e in enumerate(sources):
    if i in shell_idx_to_drop:
        continue
    if e.get("type") == "git" and "github.com" in e.get("url", ""):
        dest = git_dest_to_target.get(e["dest"])
        if not dest:
            raise SystemExit(f"no cp target found for git source {e['dest']}")
        url = f'{e["url"].rstrip("/")}/archive/{e["commit"]}.tar.gz'
        print(f"  {e['url']} @ {e['commit'][:10]} -> archive")
        with urllib.request.urlopen(url) as r:
            data = r.read()
        out.append({
            "type": "archive",
            "archive-type": "tar-gzip",
            "url": url,
            "sha256": hashlib.sha256(data).hexdigest(),
            "dest": dest,
            "strip-components": 1,
        })
        continue
    out.append(e)

json.dump(out, open(path, "w"), indent=4)
open(path, "a").write("\n")
PY

echo "==> Generating node-sources.json"
"$VENV/bin/flatpak-node-generator" npm \
  "$REPO_ROOT/package-lock.json" -o "$OUT_DIR/node-sources.json"

echo "==> Done:"
ls -la "$OUT_DIR/cargo-sources.json" "$OUT_DIR/node-sources.json"
