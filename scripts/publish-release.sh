#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist/release"
VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
TAG="v${VERSION}"
TAR_NAME="u-plus-lite-v${VERSION}-macos-linux.tar.gz"
ZIP_NAME="u-plus-lite-v${VERSION}-windows.zip"
CHECKSUM_NAME="u-plus-lite-v${VERSION}-checksums.txt"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1" >&2
    exit 1
  fi
}

require_command gh
require_command git

cd "$ROOT_DIR"

if ! gh auth status >/dev/null 2>&1; then
  echo "请先执行 gh auth login 完成 GitHub 登录" >&2
  exit 1
fi

if ! git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "本地缺少 tag $TAG，请先执行 npm run release 并确认 tag 已创建" >&2
  exit 1
fi

if [ ! -f "$DIST_DIR/$TAR_NAME" ] || [ ! -f "$DIST_DIR/$CHECKSUM_NAME" ]; then
  echo "未找到 release 包，请先执行 npm run package:release" >&2
  exit 1
fi

assets=(
  "$DIST_DIR/$TAR_NAME"
  "$DIST_DIR/$CHECKSUM_NAME"
)

if [ -f "$DIST_DIR/$ZIP_NAME" ]; then
  assets+=("$DIST_DIR/$ZIP_NAME")
fi

if gh release view "$TAG" >/dev/null 2>&1; then
  gh release upload "$TAG" "${assets[@]}" --clobber
else
  gh release create "$TAG" "${assets[@]}" --title "$TAG" --notes "Release $TAG"
fi

echo "Release 已发布:"
echo "  tag: $TAG"
printf '  asset: %s\n' "${assets[@]}"
