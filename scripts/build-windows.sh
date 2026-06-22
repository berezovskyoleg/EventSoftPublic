#!/bin/bash
# Build a Windows installer / executable.
# IMPORTANT: Tauri for Windows must be built on Windows (or via GitHub Actions).
# Run this script inside Git Bash / MSYS2 / WSL with Windows Rust installed.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "$OSTYPE" != "msys" && "$OSTYPE" != "win32" && "$OSTYPE" != "cygwin" ]]; then
  echo "ERROR: Windows Tauri builds must run on Windows."
  echo "Options:"
  echo "  1. Run this script on a Windows machine with Rust + Node installed."
  echo "  2. Use the GitHub Actions workflow: .github/workflows/release.yml"
  echo "  3. Use a Windows VM / GitHub Actions self-hosted runner."
  exit 1
fi

echo "==> Installing Node dependencies..."
npm install

echo "==> Building frontend..."
npm run build

echo "==> Building Tauri bundle for Windows x64..."
npm run tauri:build -- --target x86_64-pc-windows-msvc

echo "==> Building admin CLI..."
cargo build --release --manifest-path src-tauri/Cargo.toml --bin admin --target x86_64-pc-windows-msvc

echo ""
echo "==> Done! Output:"
find src-tauri/target/x86_64-pc-windows-msvc/release/bundle -maxdepth 3 -type f \( -name '*.msi' -o -name '*.exe' \) -print 2>/dev/null || true
echo ""
echo "Admin CLI: src-tauri/target/x86_64-pc-windows-msvc/release/admin.exe"
ls -lh src-tauri/target/x86_64-pc-windows-msvc/release/admin.exe 2>/dev/null || true
