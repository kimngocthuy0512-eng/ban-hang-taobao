#!/bin/zsh
set -euo pipefail

ROOT_DIR="/Users/bqip11/Documents/bán hàng taobao"
LOG_FILE="$ROOT_DIR/server/data/taobao-auto.log"

export TAOBAO_CRAWL=1
export TAOBAO_HEADLESS=1
export TAOBAO_SKIP_LOGIN=1
export TAOBAO_MAX_LINKS=${TAOBAO_MAX_LINKS:-30}
export TAOBAO_SCROLLS=${TAOBAO_SCROLLS:-6}

cd "$ROOT_DIR"
{
  echo "----- $(date '+%Y-%m-%d %H:%M:%S') -----"
  npm --prefix server run import:taobao:home
} >> "$LOG_FILE" 2>&1
