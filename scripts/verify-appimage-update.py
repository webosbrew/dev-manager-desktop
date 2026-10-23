#!/usr/bin/env python3
"""Check the update metadata and zsync control file of each packaged AppImage."""
import argparse
import hashlib
from pathlib import Path
import struct
import subprocess


def verify(image, channel):
    with image.open("rb") as stream:
        header = stream.read(64)
        if header[:6] != b"\x7fELF\x02\x01":
            raise ValueError(f"{image}: expected a little-endian ELF64 AppImage")
        arch = {62: "amd64", 183: "aarch64"}[struct.unpack_from("<H", header, 18)[0]]
        section_offset = struct.unpack_from("<Q", header, 40)[0]
        section_size, section_count, names_index = struct.unpack_from("<HHH", header, 58)
        stream.seek(section_offset)
        sections = [struct.unpack_from("<IIQQQQIIQQ", stream.read(section_size))
                    for _ in range(section_count)]
        names_section = sections[names_index]
        stream.seek(names_section[4])
        names = stream.read(names_section[5])
        update_info = None
        for section in sections:
            if names[section[0]:].split(b"\0", 1)[0] == b".upd_info":
                stream.seek(section[4])
                update_info = stream.read(section[5]).rstrip(b"\0").decode("ascii")
                break
    expected = subprocess.check_output(
        ["sh", str(Path(__file__).with_name("appimage-update-info.sh")), arch, channel],
        text=True).strip()
    if update_info != expected:
        raise ValueError(f"{image}: missing or incorrect .upd_info: {update_info!r}; expected {expected!r}")
    if not image.name.endswith(f"_{arch}.AppImage"):
        raise ValueError(f"{image}: filename does not match ELF architecture {arch}")
    sidecar = Path(str(image) + ".zsync")
    with sidecar.open("rb") as stream:
        fields = {}
        for line in stream:
            if line == b"\n":
                break
            key, value = line.decode("ascii").rstrip("\n").split(": ", 1)
            fields[key] = value
    if fields["Filename"] != image.name or fields["URL"] != image.name:
        raise ValueError(f"{sidecar}: Filename/URL does not match {image.name}")
    with image.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha1").hexdigest()
    if int(fields["Length"]) != image.stat().st_size or fields["SHA-1"] != digest:
        raise ValueError(f"{sidecar}: Length/SHA-1 does not match the AppImage")
    print(f"Verified {image}: {arch}, {channel}, matching zsync filename/length/SHA-1")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--channel", choices=["latest", "latest-pre"], default="latest")
    parser.add_argument("images", nargs="+", type=Path)
    args = parser.parse_args()
    for image in args.images:
        verify(image, args.channel)
