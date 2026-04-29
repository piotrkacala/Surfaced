#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRAMES_DIR="$ROOT_DIR/output/playwright"
OUTPUT_DIR="$ROOT_DIR/output/animations"
FPS="${1:-5}"

mkdir -p "$OUTPUT_DIR"

encode_sequence() {
  local name="$1"
  local input_pattern="$FRAMES_DIR/$name/frame-%03d.png"
  local mp4_output="$OUTPUT_DIR/$name.mp4"
  local gif_output="$OUTPUT_DIR/$name.gif"
  local palette_file

  if [[ ! -f "${input_pattern/\%03d/000}" ]]; then
    echo "Missing frames for $name" >&2
    return 1
  fi

  palette_file="$(mktemp --suffix=.png)"

  ffmpeg -y \
    -framerate "$FPS" \
    -i "$input_pattern" \
    -c:v libx264 \
    -pix_fmt yuv420p \
    -movflags +faststart \
    "$mp4_output" >/dev/null 2>&1

  ffmpeg -y \
    -framerate "$FPS" \
    -i "$input_pattern" \
    -vf "fps=$FPS,palettegen" \
    "$palette_file" >/dev/null 2>&1

  ffmpeg -y \
    -framerate "$FPS" \
    -i "$input_pattern" \
    -i "$palette_file" \
    -lavfi "fps=$FPS[x];[x][1:v]paletteuse" \
    "$gif_output" >/dev/null 2>&1

  rm -f "$palette_file"
  echo "Encoded $name -> $mp4_output and $gif_output"
}

encode_sequence "anim-preview-edit"
encode_sequence "anim-reminder-depth"
encode_sequence "anim-site-override"
