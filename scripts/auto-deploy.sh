#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INTERVAL="${AUTO_DEPLOY_INTERVAL:-2}"
DEBOUNCE="${AUTO_DEPLOY_DEBOUNCE:-5}"
DEPLOY_SCRIPT="${AUTO_DEPLOY_SCRIPT:-$ROOT_DIR/scripts/deploy-cloudflare.sh}"

collect_files() {
  find "$ROOT_DIR" -maxdepth 1 -type f -name "*.html" -print0
  if [ -d "$ROOT_DIR/assets" ]; then
    find "$ROOT_DIR/assets" -type f -print0
  fi
  if [ -d "$ROOT_DIR/server/data/media" ]; then
    find "$ROOT_DIR/server/data/media" -type f -print0
  fi
}

build_hash() {
  collect_files | xargs -0 stat -f "%m %N" | LC_ALL=C sort | shasum | awk '{print $1}'
}

last_hash="$(build_hash)"
last_deploy=0

while true; do
  current_hash="$(build_hash || true)"
  if [ -n "$current_hash" ] && [ "$current_hash" != "$last_hash" ]; then
    now="$(date +%s)"
    if [ $((now - last_deploy)) -ge "$DEBOUNCE" ]; then
      "$DEPLOY_SCRIPT" || true
      last_deploy="$now"
    fi
    last_hash="$current_hash"
  fi
  sleep "$INTERVAL"
done
