#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$HERE/../.." && pwd)"
DIST="$HERE/dist"

rm -rf "$DIST"
mkdir -p "$DIST"

cp "$HERE/index.mjs" "$DIST/"
cp "$HERE/normalize.mjs" "$DIST/"
cp "$HERE/aliases.json" "$DIST/"
cp "$HERE/package.json" "$DIST/"
cp "$PROJECT_ROOT/matches.json" "$DIST/matches.json"

cd "$DIST"
zip -q -r ../bundle.zip .
echo "Wrote $HERE/bundle.zip ($(stat -f %z ../bundle.zip 2>/dev/null || stat -c %s ../bundle.zip) bytes)"
