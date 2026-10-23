#!/bin/sh
# Generate control files from the final packaged bytes; bundler plugins may omit them.
set -eu
for image do
  directory=$(dirname "$image")
  filename=$(basename "$image")
  (
    cd "$directory"
    zsyncmake -u "$filename" -o "$filename.zsync" "$filename"
  )
done
