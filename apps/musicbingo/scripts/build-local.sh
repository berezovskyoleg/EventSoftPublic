#!/bin/bash
# Build the desktop app for the current platform (macOS / Windows / Linux).
# Output: src-tauri/target/release/bundle/
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing Node dependencies..."
npm install

echo "==> Building frontend..."
npm run build

echo "==> Building Tauri bundle..."
npm run tauri:build

echo "==> Building admin CLI..."
cargo build --release --manifest-path src-tauri/Cargo.toml --bin admin

echo ""
echo "==> Done! Bundled artifacts:"
find src-tauri/target/release/bundle -maxdepth 3 -type f \( -name '*.dmg' -o -name '*.app' -o -name '*.msi' -o -name '*.exe' \) -print 2>/dev/null || true
echo ""
echo "Admin CLI: src-tauri/target/release/admin"
ls -lh src-tauri/target/release/admin 2>/dev/null || ls -lh src-tauri/target/release/admin.exe 2>/dev/null || true
