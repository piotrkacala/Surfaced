#!/usr/bin/env bash
set -euo pipefail

PLATFORM="${1:-all}"

build() {
  local platform="$1"
  local manifest="$platform/manifest.json"

  if [[ ! -f "$manifest" ]]; then
    echo "Error: $manifest not found" >&2
    exit 1
  fi

  local version
  version=$(grep '"version"' "$manifest" | sed 's/.*"version": *"\([^"]*\)".*/\1/')
  local output="dist/surfaced-${platform}-${version}.zip"

  local tmpdir
  tmpdir=$(mktemp -d)

  cp -r shared/. "$tmpdir/"
  cp -r "$platform/." "$tmpdir/"

  mkdir -p dist
  (cd "$tmpdir" && zip -qr "$OLDPWD/$output" . -x "*.DS_Store" -x "__MACOSX/*")
  rm -rf "$tmpdir"

  echo "Built: $output"
}

case "$PLATFORM" in
  desktop|android)
    build "$PLATFORM"
    ;;
  all)
    build desktop
    build android
    ;;
  *)
    echo "Usage: ./build.sh [desktop|android|all]" >&2
    exit 1
    ;;
esac
