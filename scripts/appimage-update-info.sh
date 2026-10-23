#!/bin/sh
# Keep asset selection separate for each architecture and release channel.
set -eu
host_arch=${1:-$(uname -m)}
case "$host_arch" in
  x86_64|amd64) arch=amd64 ;;
  aarch64|arm64) arch=aarch64 ;;
  *) echo "Unsupported AppImage architecture: $host_arch" >&2; exit 1 ;;
esac
channel=${2:-latest}
case "$channel" in
  latest|latest-pre) ;;
  *) echo "Unsupported AppImage update channel: $channel" >&2; exit 1 ;;
esac
printf 'gh-releases-zsync|webosbrew|dev-manager-desktop|%s|webos-dev-manager_*_%s.AppImage.zsync\n' "$channel" "$arch"
