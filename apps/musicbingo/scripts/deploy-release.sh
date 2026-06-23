#!/bin/bash
set -e

VERSION="${1:-0.1.0}"
SERVER="root@soft.eventhunt.ru"
REMOTE_DIR="/opt/eventhunt-license-server/releases/musicbingo"

echo "Deploying MusicBingo v${VERSION} to ${SERVER}:${REMOTE_DIR}..."

ssh -o StrictHostKeyChecking=no "${SERVER}" "mkdir -p ${REMOTE_DIR}"

if [ -d "src-tauri/target/universal-apple-darwin/release/bundle/dmg" ]; then
  scp -o StrictHostKeyChecking=no src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg "${SERVER}:${REMOTE_DIR}/"
fi

if [ -d "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi" ]; then
  scp -o StrictHostKeyChecking=no src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/*.msi "${SERVER}:${REMOTE_DIR}/"
fi

if [ -d "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis" ]; then
  scp -o StrictHostKeyChecking=no src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe "${SERVER}:${REMOTE_DIR}/"
fi

echo "Upload complete."
