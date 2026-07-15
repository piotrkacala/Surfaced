#!/usr/bin/env bash
set -euo pipefail

PLATFORM="${1:-unified}"
readonly NORMALIZED_TIMESTAMP="200001010000.00"

usage() {
  echo "Usage: ./build.sh [desktop|android|chrome|unified|all]" >&2
}

case "$PLATFORM" in
  desktop|android|chrome|unified|all)
    ;;
  *)
    usage
    exit 1
    ;;
esac

validate_manifests() {
  node - android/manifest.json desktop/manifest.json chrome/manifest.json <<'NODE'
const fs = require("node:fs");

const [androidPath, desktopPath, chromePath] = process.argv.slice(2);
const manifests = [androidPath, desktopPath, chromePath].map((filePath) => {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${filePath}: missing or invalid JSON (${error.message})`);
  }

  if (typeof parsed.version !== "string" || parsed.version.trim() === "") {
    throw new Error(`${filePath}: manifest version is missing`);
  }

  return { filePath, version: parsed.version };
});

const versions = new Set(manifests.map(({ version }) => version));
if (versions.size !== 1) {
  throw new Error(`manifest version mismatch: ${manifests.map(({ filePath, version }) => `${filePath}=${version}`).join(", ")}`);
}

process.stdout.write(manifests[0].version);
NODE
}

VERSION="$(validate_manifests)"
readonly VERSION

validate_current_version() {
  local current_version

  current_version="$(validate_manifests)"
  if [[ "$current_version" != "$VERSION" ]]; then
    echo "manifest version changed during build: started with ${VERSION}, now ${current_version}" >&2
    return 1
  fi
}

output_for_target() {
  case "$1" in
    unified) echo "dist/surfaced-${VERSION}.zip" ;;
    desktop|android|chrome) echo "dist/surfaced-$1-${VERSION}.zip" ;;
  esac
}

create_deterministic_zip() {
  local source_dir="$1"
  local output="$2"
  local output_name
  local temp_output

  output_name="$(basename "$output")"
  mkdir -p dist
  temp_output="$(mktemp --suffix=.zip "dist/.${output_name}.tmp.XXXXXX")"
  rm -f -- "$temp_output"

  cleanup_build() {
    rm -rf -- "$source_dir"
    rm -f -- "$temp_output"
  }

  trap cleanup_build EXIT
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  find "$source_dir" -name '.DS_Store' -type f -delete
  find "$source_dir" -name '__MACOSX' -type d -prune -exec rm -rf -- {} +
  TZ=UTC touch -t "$NORMALIZED_TIMESTAMP" "$source_dir"
  find "$source_dir" -exec env TZ=UTC touch -h -t "$NORMALIZED_TIMESTAMP" {} +

  (
    cd "$source_dir"
    find . -type f -print | LC_ALL=C sort | zip -X -q "$OLDPWD/$temp_output" -@
  )

  mv -f -- "$temp_output" "$output"
  trap - EXIT HUP INT TERM
  rm -rf -- "$source_dir"
  echo "Built current ${VERSION} artifact: $output"
}

build_platform() (
  set -euo pipefail
  validate_current_version

  local platform="$1"
  local manifest="$platform/manifest.json"
  local output
  local tmpdir

  output="$(output_for_target "$platform")"
  tmpdir="$(mktemp -d)"
  trap 'rm -rf -- "$tmpdir"' EXIT
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  cp -r shared/. "$tmpdir/"
  if [[ "$platform" == "chrome" ]]; then
    mkdir -p "$tmpdir/popup"
    cp -r desktop/popup/. "$tmpdir/popup/"
  fi
  cp -r "$platform/." "$tmpdir/"
  rm -f "$tmpdir/popup/dispatcher.js"

  validate_current_version
  create_deterministic_zip "$tmpdir" "$output"
)

build_unified() (
  set -euo pipefail
  validate_current_version

  local output
  local tmpdir

  output="$(output_for_target unified)"
  tmpdir="$(mktemp -d)"
  trap 'rm -rf -- "$tmpdir"' EXIT
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  cp -r shared/. "$tmpdir/"
  cp android/manifest.json "$tmpdir/manifest.json"
  mkdir -p "$tmpdir/popup/desktop" "$tmpdir/popup/android"
  cp -r desktop/popup/. "$tmpdir/popup/desktop/"
  cp -r android/popup/. "$tmpdir/popup/android/"

  validate_current_version
  create_deterministic_zip "$tmpdir" "$output"
)

warn_about_old_artifacts() {
  [[ -d dist ]] || return 0

  local old_artifacts=()
  local file
  while IFS= read -r file; do
    case "$file" in
      "$(output_for_target unified)"|"$(output_for_target desktop)"|"$(output_for_target android)"|"$(output_for_target chrome)")
        ;;
      *) old_artifacts+=("$file") ;;
    esac
  done < <(find dist -maxdepth 1 -type f -name 'surfaced*.zip' -print | LC_ALL=C sort)

  if ((${#old_artifacts[@]} > 0)); then
    echo "Preserved older Surfaced artifacts (not part of release ${VERSION}):" >&2
    printf '  %s\n' "${old_artifacts[@]}" >&2
  fi
}

print_release_artifacts() {
  local outputs=(
    "$(output_for_target unified)"
    "$(output_for_target desktop)"
    "$(output_for_target android)"
    "$(output_for_target chrome)"
  )

  echo "Current release ${VERSION} artifacts and SHA-256:"
  sha256sum "${outputs[@]}"
}

case "$PLATFORM" in
  desktop|android|chrome)
    build_platform "$PLATFORM"
    warn_about_old_artifacts
    ;;
  unified)
    build_unified
    warn_about_old_artifacts
    ;;
  all)
    build_platform desktop
    build_platform android
    build_platform chrome
    build_unified
    warn_about_old_artifacts
    print_release_artifacts
    ;;
esac
