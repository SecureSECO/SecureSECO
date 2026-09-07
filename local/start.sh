#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
export PATH="/Applications/Docker.app/Contents/Resources/bin:/opt/homebrew/bin:$PATH"
docker compose -f compose.local.yaml up -d --build
