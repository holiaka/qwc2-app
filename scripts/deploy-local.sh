#!/usr/bin/env bash
set -euo pipefail

TARGET="../volumes/qwc2-custom"
BUILD_DIR="./prod"
STAGING="../volumes/.qwc2-custom-staging"

if [ ! -d "$BUILD_DIR" ]; then
  echo "Build dir not found: $BUILD_DIR"
  exit 1
fi

mkdir -p "$(dirname "$TARGET")"
rm -rf "$STAGING"
mkdir -p "$STAGING"

rsync -a --delete "$BUILD_DIR"/ "$STAGING"/

rm -rf "$TARGET"
mv "$STAGING" "$TARGET"

echo "Deployed $BUILD_DIR -> $TARGET"