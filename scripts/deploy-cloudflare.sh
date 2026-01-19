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

PROJECT_NAME="${CF_PAGES_PROJECT:-}"
BRANCH_NAME="${CF_PAGES_BRANCH:-}"
API_TOKEN="${CLOUDFLARE_API_TOKEN:-${CF_API_TOKEN:-}}"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${CF_ACCOUNT_ID:-}}"

if [ -z "${PROJECT_NAME}" ]; then
  echo "Missing CF_PAGES_PROJECT (Cloudflare Pages project name)." >&2
  exit 1
fi

if [ -z "${API_TOKEN}" ]; then
  echo "Missing CLOUDFLARE_API_TOKEN (or CF_API_TOKEN) for non-interactive deploy." >&2
  exit 1
fi

if [ -z "${ACCOUNT_ID}" ]; then
  echo "Missing CLOUDFLARE_ACCOUNT_ID (or CF_ACCOUNT_ID)." >&2
  exit 1
fi

ARGS=(pages deploy "${OUT_DIR}" --project-name "${PROJECT_NAME}")
if [ -n "${BRANCH_NAME}" ]; then
  ARGS+=(--branch "${BRANCH_NAME}")
fi

npx --yes wrangler "${ARGS[@]}"
