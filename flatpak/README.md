# Flatpak packaging

This directory contains everything needed to package **webOS Dev Manager** as a
[Flatpak](https://flatpak.org/), both for distribution as a standalone bundle and
as a starting point for a [Flathub](https://flathub.org/) submission
(see [#409](https://github.com/webosbrew/dev-manager-desktop/issues/409)).

| File | Purpose |
|------|---------|
| `org.webosbrew.devman.yml` | Flatpak manifest. Packages the binary from the Tauri `.deb` into the GNOME 46 runtime. |
| `org.webosbrew.devman.metainfo.xml` | AppStream metadata (name, description, screenshots, releases) required by Flathub. |

The Tauri app links against `webkit2gtk-4.1`, which ships in the GNOME 46
runtime, so no extra libraries are built inside the sandbox.

## Build locally

You need `flatpak` and `flatpak-builder`, plus the normal toolchain for building
the app (Node.js, Rust, and the `webkit2gtk-4.1` development packages — see the
root `README.md` / CI workflows).

```bash
# From the repository root:
./scripts/build-flatpak.sh
```

This builds the `.deb`, stages it as `flatpak/webos-dev-manager.deb`, builds the
Flatpak, and writes `flatpak/org.webosbrew.devman.flatpak`. Install and run it
with:

```bash
flatpak install --user flatpak/org.webosbrew.devman.flatpak
flatpak run org.webosbrew.devman
```

CI builds the same bundle on every change to this directory
(`.github/workflows/build-flatpak.yml`) and attaches it to GitHub releases.

## Publishing to Flathub

Flathub apps live in a dedicated repository (`flathub/org.webosbrew.devman`) and
are built by Flathub's own infrastructure, which has **no network access** and
builds only from pinned sources. To submit:

1. Fork [`flathub/flathub`](https://github.com/flathub/flathub) and follow the
   [submission guide](https://docs.flathub.org/docs/for-app-authors/submission).
2. Copy `org.webosbrew.devman.yml` and `org.webosbrew.devman.metainfo.xml` into
   the submission.
3. In the manifest, replace the local `webos-dev-manager.deb` source with the
   published release artifact and its checksum, so Flathub can fetch it
   reproducibly. For example:

   ```yaml
   - type: file
     url: https://github.com/webosbrew/dev-manager-desktop/releases/download/v1.99.16/webos-dev-manager_1.99.16_amd64.deb
     sha256: <sha256-of-the-deb>
     only-arches: [x86_64]
   ```

   Add a matching `aarch64` source (using the `arm64.deb`) if an arm64 build is
   desired.
4. Keep `org.webosbrew.devman.metainfo.xml` up to date — add a `<release>` entry
   for each version so updates show changelogs in software centers.
