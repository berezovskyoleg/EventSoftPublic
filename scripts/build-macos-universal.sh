#!/bin/bash
# Build a universal macOS .app bundle + DMG that runs natively on both
# Apple Silicon (arm64) and Intel (x86_64) Macs.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Adding Rust targets..."
rustup target add x86_64-apple-darwin aarch64-apple-darwin

echo "==> Installing Node dependencies..."
npm install

echo "==> Building frontend..."
npm run build

echo "==> Building universal Tauri bundle..."
npm run tauri:build -- --target universal-apple-darwin

echo "==> Building universal admin CLI..."
cargo build --release --manifest-path src-tauri/Cargo.toml --bin admin --target x86_64-apple-darwin
cargo build --release --manifest-path src-tauri/Cargo.toml --bin admin --target aarch64-apple-darwin
mkdir -p src-tauri/target/universal-apple-darwin/release
lipo -create \
  src-tauri/target/x86_64-apple-darwin/release/admin \
  src-tauri/target/aarch64-apple-darwin/release/admin \
  -output src-tauri/target/universal-apple-darwin/release/admin

echo ""
echo "==> Done! Universal bundle:"
find src-tauri/target/universal-apple-darwin/release/bundle -maxdepth 3 -type f \( -name '*.dmg' -o -name '*.app' \) -print 2>/dev/null || true
echo ""
echo "Universal admin CLI: src-tauri/target/universal-apple-darwin/release/admin"
ls -lh src-tauri/target/universal-apple-darwin/release/admin 2>/dev/null || true
