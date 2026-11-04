#!/bin/sh
# Fail unless each architecture of each app bundle has a bundle signature whose
# identifier matches CFBundleIdentifier.
#
# macOS looks up the Local Network permission by signing identifier. A
# linker-only signature uses "<binary>-<hash>" as the identifier, which changes
# with every build. The permission then never matches, and connections to the
# TV fail with EHOSTUNREACH ("No route to host", issue #417).
set -eu
status=0
for app do
  plist="$app/Contents/Info.plist"
  expected=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$plist")
  executable=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$plist")
  for arch in $(lipo -archs "$app/Contents/MacOS/$executable"); do
    if ! info=$(codesign -dv --arch "$arch" "$app" 2>&1); then
      echo "error: $app [$arch]: $info" >&2
      status=1
      continue
    fi
    identifier=$(printf '%s\n' "$info" | sed -n 's/^Identifier=//p')
    flags=$(printf '%s\n' "$info" | sed -n 's/^CodeDirectory .*flags=\([^ ]*\).*/\1/p')
    echo "$app [$arch]: Identifier=$identifier flags=$flags"
    if [ "$identifier" != "$expected" ]; then
      echo "error: $app [$arch]: signing identifier is '$identifier', expected '$expected'" >&2
      status=1
    fi
    case $flags in
      *linker-signed*)
        echo "error: $app [$arch]: only the linker signed this binary" >&2
        status=1
        ;;
    esac
  done
  codesign --verify --strict --verbose=2 "$app"
done
exit $status
