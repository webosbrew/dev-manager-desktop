# Flatpak packaging

This directory packages **webOS Dev Manager** as a [Flatpak](https://flatpak.org/),
built **from source**, ready for distribution as a standalone bundle and as a
starting point for a [Flathub](https://flathub.org/) submission
(see [#409](https://github.com/webosbrew/dev-manager-desktop/issues/409)).

| File | Purpose |
|------|---------|
| `org.webosbrew.devman.yml` | Flatpak manifest. Compiles the Angular frontend and Tauri/Rust backend offline inside the GNOME 46 runtime. |
| `org.webosbrew.devman.metainfo.xml` | AppStream metadata (name, description, screenshots, releases) required by Flathub. |
| `org.webosbrew.devman.desktop` | Desktop entry installed under the Flatpak app id. |
| `node-sources.json` | Vendored npm dependencies (generated). |
| `cargo-sources.json` | Vendored cargo dependencies, including the `r2d2` git crate (generated). |

Flatpak/Flathub builds run with **no network access**, so every npm and cargo
dependency is vendored up front. The Tauri app links against `webkit2gtk-4.1`,
which ships in the GNOME 46 runtime, so no extra libraries are built.

## Regenerating the vendored sources

`node-sources.json` and `cargo-sources.json` are generated from
`package-lock.json` and `Cargo.lock`. Regenerate them whenever those lockfiles
change:

```bash
./scripts/flatpak-gen-sources.sh
```

This needs network access (the generators download dependency archives to hash
them) and `node_modules` to be absent.

## Build locally

You need `flatpak` and `flatpak-builder`:

```bash
./scripts/build-flatpak.sh
```

This installs the GNOME 46 runtime/SDK plus the `node20` and `rust-stable` SDK
extensions, builds the app, and writes `flatpak/org.webosbrew.devman.flatpak`.
Install and run it with:

```bash
flatpak install --user flatpak/org.webosbrew.devman.flatpak
flatpak run org.webosbrew.devman
```

CI builds the same bundle on every change to this directory
(`.github/workflows/build-flatpak.yml`) and attaches it to GitHub releases.

## Publishing to Flathub

Flathub apps live in a dedicated repository (`flathub/org.webosbrew.devman`) and
are built by Flathub's own (offline) infrastructure. To submit:

1. Fork [`flathub/flathub`](https://github.com/flathub/flathub) and follow the
   [submission guide](https://docs.flathub.org/docs/for-app-authors/submission).
2. Copy `org.webosbrew.devman.yml`, `org.webosbrew.devman.metainfo.xml`,
   `org.webosbrew.devman.desktop`, `node-sources.json` and `cargo-sources.json`
   into the submission.
3. In the manifest, replace the `type: dir` application source with a pinned
   release so Flathub can fetch it reproducibly, for example:

   ```yaml
   - type: archive
     url: https://github.com/webosbrew/dev-manager-desktop/archive/refs/tags/v1.99.16.tar.gz
     sha256: <sha256-of-the-tarball>
   ```

   Regenerate the vendored sources from that tag's lockfiles so they match.
4. Keep `org.webosbrew.devman.metainfo.xml` up to date — add a `<release>` entry
   for each version so updates show changelogs in software centers.
