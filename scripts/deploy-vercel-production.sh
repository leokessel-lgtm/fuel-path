#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

mkdir -p .npm-cache

npm_config_cache=.npm-cache npx vercel --prod --yes "$@"
