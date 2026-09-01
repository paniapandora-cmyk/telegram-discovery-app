#!/usr/bin/env bash
set -euo pipefail

test -s index.html
test -s worker.ts
grep -q "Telegram.WebApp" index.html
grep -q "/api/discovery" index.html
grep -Eiq "feed|search|trending|explore" index.html
grep -q 'discovery-api-live' worker.ts
grep -q 'discovery-search-v6' worker.ts
grep -q '"/api/creator"' worker.ts

echo "Telegram Discovery smoke checks passed."
