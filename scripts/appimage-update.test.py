"""Ensure update channels select only published assets for the same architecture."""
import fnmatch
from pathlib import Path
import subprocess
import unittest

SCRIPT = Path(__file__).with_name("appimage-update-info.sh")
ASSETS = [f"webos-dev-manager_1.99.20_{arch}.AppImage.zsync"
          for arch in ["amd64", "aarch64"]]


class UpdateSelectors(unittest.TestCase):
    def test_architecture_and_channel_selection(self):
        for host, arch in [("x86_64", "amd64"), ("amd64", "amd64"),
                           ("aarch64", "aarch64"), ("arm64", "aarch64")]:
            for channel in ["latest", "latest-pre"]:
                with self.subTest(host=host, channel=channel):
                    info = subprocess.check_output(["sh", str(SCRIPT), host, channel], text=True).strip()
                    transport, owner, repo, tag, pattern = info.split("|")
                    self.assertEqual((transport, owner, repo, tag),
                                     ("gh-releases-zsync", "webosbrew", "dev-manager-desktop", channel))
                    self.assertEqual([asset for asset in ASSETS if fnmatch.fnmatchcase(asset, pattern)],
                                     [f"webos-dev-manager_1.99.20_{arch}.AppImage.zsync"])

    def test_snapshots_default_to_stable(self):
        info = subprocess.check_output(["sh", str(SCRIPT), "x86_64"], text=True).strip()
        self.assertEqual(info.split("|")[3], "latest")

    def test_unsupported_architecture_or_channel_fails(self):
        for args in [("i386", "latest"), ("x86_64", "nightly")]:
            with self.subTest(args=args):
                result = subprocess.run(["sh", str(SCRIPT), *args], capture_output=True)
                self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
