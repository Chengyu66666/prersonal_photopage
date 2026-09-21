#!/usr/bin/env bash
#
# Cloudflare Pages build step.
#
# Pages checks this repository out and then publishes whatever lands in the
# build output directory. Pointing the output directory at the repo root would
# also publish README.md, scripts/, netlify.toml and .gitignore, so this script
# stages just the site into dist/ instead.
#
#   Pages build command:   bash scripts/build_site.sh
#   Pages output directory: dist
#
# The copy is a plain filesystem copy inside the build container -- roughly
# 240 MB -- so it costs seconds, not minutes.
set -euo pipefail

cd "$(dirname "$0")/.."

ROOT_FILES=(
  index.html
  portfolio.html
  xian-city-wall-map.html
  script.js
  portfolio-page.js
  xian-map.js
  hero-sets.js
  photo-data.js
  image-guard.js
  styles.css
  _headers
)

rm -rf dist
mkdir -p dist

for f in "${ROOT_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "build_site.sh: required file missing: $f" >&2
    exit 1
  fi
  cp "$f" dist/
done

# assets/ carries the photo tree, the homepage collage, the logo and the QR
# code. Copy whole; there is nothing in it that must not be published.
cp -r assets dist/assets

echo "staged $(find dist -type f | wc -l) files into dist/"
