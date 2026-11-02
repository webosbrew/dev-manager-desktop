#!/usr/bin/env python3
"""Reject AppImages that bundle the host's libwayland-client.

linuxdeploy's dependency follower can sweep the build host's
libwayland-client.so into the AppImage. That copy predates the wl_*
protocol entries current Mesa EGL ICDs reference, so on a Wayland
session eglGetDisplay(EGL_DEFAULT_DISPLAY) fails with EGL_BAD_PARAMETER
and WebKitGTK aborts ("Could not create default EGL display"). The
AppImage must resolve libwayland-client against the host, like it
already does for the Mesa/EGL stack. See tauri-apps/tauri#15665 and
#369 upstream.

Note: current linuxdeploy may still ship libwayland-{cursor,egl,server};
those have been verified not to disturb current Mesa and are not
rejected here. What kills the app is the client library.
"""
import argparse
import fnmatch
import subprocess
import tempfile
from pathlib import Path

FORBIDDEN_PATTERNS = ("libwayland-client.so*",)


def bundled_files(root):
    for path in sorted(root.rglob("*")):
        if path.is_file() and any(fnmatch.fnmatch(path.name, pattern) for pattern in FORBIDDEN_PATTERNS):
            yield path.relative_to(root)


def verify(image):
    image = image.resolve()
    with tempfile.TemporaryDirectory(prefix=f"appimage-verify-{image.stem}-") as tmp:
        result = subprocess.run(
            [str(image), "--appimage-extract"], cwd=tmp, capture_output=True, text=True)
        if result.returncode != 0:
            raise ValueError(f"{image}: --appimage-extract failed: {result.stderr.strip()}")
        offenders = list(bundled_files(Path(tmp) / "squashfs-root"))
    if offenders:
        listing = "\n  ".join(str(offender) for offender in offenders)
        raise ValueError(
            f"{image}: bundles host-provided libwayland-client:\n  {listing}\n"
            "Remove it so the host's libwayland-client is used; the bundled copy "
            "breaks newer Mesa EGL under Wayland sessions.")
    print(f"Verified {image}: no {'/'.join(FORBIDDEN_PATTERNS)} bundled")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("images", nargs="+", type=Path)
    args = parser.parse_args()
    for image in args.images:
        verify(image)
