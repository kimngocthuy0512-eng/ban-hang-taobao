#!/bin/zsh
set -euo pipefail

ROOT_DIR="/Users/bqip11/Documents/bán hàng taobao"
LOG_FILE="$ROOT_DIR/server/data/taobao-auto.log"

export TAOBAO_CRAWL=1
export TAOBAO_WAIT_LOGIN=1
export TAOBAO_FORCE_LOGIN=1
export TAOBAO_HEADLESS=0
export TAOBAO_SKIP_LOGIN=0
export TAOBAO_LOGIN_TIMEOUT=300000
export TAOBAO_LOGIN_MIN_WAIT=60000
export TAOBAO_LOGIN_URL="https://world.taobao.com/wow/z/oversea/SEO-SEM/ovs-pc-login"
export TAOBAO_BROWSER_CHANNEL="chrome"
export TAOBAO_PAGE_WAIT=4000
export TAOBAO_SCROLL_DELAY=2500
export TAOBAO_IMPORT_DELAY=1800
export TAOBAO_ERROR_DELAY=1800
export TAOBAO_MAX_LINKS=${TAOBAO_MAX_LINKS:-30}
export TAOBAO_SCROLLS=${TAOBAO_SCROLLS:-6}

cd "$ROOT_DIR"
{
  echo "----- $(date '+%Y-%m-%d %H:%M:%S') -----"
  npm --prefix server run import:taobao:home
} >> "$LOG_FILE" 2>&1
