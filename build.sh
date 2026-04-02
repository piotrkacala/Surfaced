#!/usr/bin/env bash
set -euo pipefail

PLATFORM="${1:-unified}"

build_platform() {
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

build_unified() {
  local version
  version=$(grep '"version"' android/manifest.json | sed 's/.*"version": *"\([^"]*\)".*/\1/')
  local output="dist/surfaced-${version}.zip"
  local tmpdir
  tmpdir=$(mktemp -d)

  # shared files (includes popup/popup.html dispatcher)
  cp -r shared/. "$tmpdir/"

  # unified manifest: android/manifest.json has both gecko + gecko_android
  cp android/manifest.json "$tmpdir/manifest.json"

  # platform popups under popup/desktop/ and popup/android/
  mkdir -p "$tmpdir/popup/desktop" "$tmpdir/popup/android"
  cp -r desktop/popup/. "$tmpdir/popup/desktop/"
  cp -r android/popup/. "$tmpdir/popup/android/"

  mkdir -p dist
  (cd "$tmpdir" && zip -qr "$OLDPWD/$output" . -x "*.DS_Store" -x "__MACOSX/*")
  rm -rf "$tmpdir"

  echo "Built: $output"
}

case "$PLATFORM" in
  desktop|android)
    build_platform "$PLATFORM"
    ;;
  unified)
    build_unified
    ;;
  all)
    build_platform desktop
    build_platform android
    build_unified
    ;;
  *)
    echo "Usage: ./build.sh [desktop|android|unified|all]" >&2
    exit 1
    ;;
esac
