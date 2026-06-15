#!/bin/sh
set -eu

rm -rf public

mkdir -p public/assets/brand-icons
mkdir -p public/prototype/data

cp web-demo/index.html public/index.html
cp web-demo/app.js public/app.js
cp web-demo/styles.css public/styles.css
cp -R web-demo/assets/brand-icons/. public/assets/brand-icons/

cp prototype/data/routes.json public/prototype/data/routes.json
cp prototype/data/sample-stations.json public/prototype/data/sample-stations.json

cat > public/robots.txt <<'EOF'
User-agent: *
Disallow:
EOF
