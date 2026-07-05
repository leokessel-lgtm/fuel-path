#!/bin/sh
set -eu

rm -rf public

cd mobile-app
npm run sync:discounts
EXPO_PUBLIC_FUEL_PATH_API_BASE_URL=__SAME_ORIGIN__ npm_config_cache=.npm-cache npx expo export --platform web --output-dir ../public
cd ..

mkdir -p public/web-demo
cp web-demo/privacy.html public/web-demo/privacy.html
cp web-demo/styles.css public/web-demo/styles.css

cat > public/robots.txt <<'EOF'
User-agent: *
Disallow:
EOF
