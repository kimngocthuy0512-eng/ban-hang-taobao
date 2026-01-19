#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/dist"

rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}"

cp "${ROOT_DIR}"/*.html "${OUT_DIR}/"
cp -R "${ROOT_DIR}/assets" "${OUT_DIR}/assets"

if [ -d "${ROOT_DIR}/server/data/media" ]; then
  mkdir -p "${OUT_DIR}/media"
  cp -R "${ROOT_DIR}/server/data/media/" "${OUT_DIR}/media/"
fi
