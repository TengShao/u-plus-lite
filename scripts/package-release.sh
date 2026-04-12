#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist/release"
STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/u-plus-lite-package.XXXXXX")"
VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
TAR_NAME="u-plus-lite-v${VERSION}-macos-linux.tar.gz"
ZIP_NAME="u-plus-lite-v${VERSION}-windows.zip"
CHECKSUM_NAME="u-plus-lite-v${VERSION}-checksums.txt"

cleanup() {
  rm -rf "$STAGE_DIR"
}
trap cleanup EXIT

mkdir -p "$DIST_DIR"
rm -f "$DIST_DIR/$TAR_NAME" "$DIST_DIR/$ZIP_NAME" "$DIST_DIR/$CHECKSUM_NAME"

cd "$ROOT_DIR"
npm install
npm run build

mkdir -p "$STAGE_DIR"

copy_item() {
  local source="$1"
  if [ -e "$source" ]; then
    mkdir -p "$STAGE_DIR/$(dirname "$source")"
    cp -R "$source" "$STAGE_DIR/$source"
  fi
}

copy_item package.json
copy_item package-lock.json
copy_item next.config.js
copy_item postcss.config.js
copy_item tailwind.config.ts
copy_item tsconfig.json
copy_item deploy
copy_item public
copy_item prisma
copy_item .next

tar -czf "$DIST_DIR/$TAR_NAME" -C "$STAGE_DIR" .

if command -v zip >/dev/null 2>&1; then
  (
    cd "$STAGE_DIR"
    zip -rq "$DIST_DIR/$ZIP_NAME" .
  )
else
  echo "zip 不可用，跳过 Windows 压缩包生成" >&2
fi

(
  cd "$DIST_DIR"
  if [ -f "$ZIP_NAME" ]; then
    shasum -a 256 "$TAR_NAME" "$ZIP_NAME" > "$CHECKSUM_NAME"
  else
    shasum -a 256 "$TAR_NAME" > "$CHECKSUM_NAME"
  fi
)

echo "Release package created:"
echo "  $DIST_DIR/$TAR_NAME"
[ -f "$DIST_DIR/$ZIP_NAME" ] && echo "  $DIST_DIR/$ZIP_NAME"
echo "  $DIST_DIR/$CHECKSUM_NAME"
