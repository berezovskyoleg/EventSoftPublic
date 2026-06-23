#!/bin/bash
# Build a macOS .app bundle + DMG for the current architecture.
# On Apple Silicon Macs this produces an arm64 bundle.
# On Intel Macs this produces an x86_64 bundle.
# For a universal bundle see build-macos-universal.sh.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing Node dependencies..."
npm install

echo "==> Building frontend..."
npm run build

echo "==> Building Tauri bundle for macOS..."
npm run tauri:build

echo "==> Building admin CLI..."
cargo build --release --manifest-path src-tauri/Cargo.toml --bin admin

echo ""
echo "==> Done! Output:"
find src-tauri/target/release/bundle -maxdepth 3 -type f \( -name '*.dmg' -o -name '*.app' \) -print 2>/dev/null || true
echo ""
echo "Admin CLI: src-tauri/target/release/admin"
ls -lh src-tauri/target/release/admin 2>/dev/null || true
