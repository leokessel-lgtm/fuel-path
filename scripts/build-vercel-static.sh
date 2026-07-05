#!/bin/sh
set -eu

rm -rf public

BUILD_ID="${VERCEL_GIT_COMMIT_SHA:-$(git rev-parse --short=12 HEAD 2>/dev/null || date -u +%Y%m%d%H%M%S)}"
BUILD_CREATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cd mobile-app
npm run sync:discounts
EXPO_PUBLIC_FUEL_PATH_API_BASE_URL=__SAME_ORIGIN__ EXPO_PUBLIC_FUEL_PATH_BUILD_ID="$BUILD_ID" npm_config_cache=.npm-cache npx expo export --platform web --output-dir ../public
cd ..

mkdir -p public/web-demo
cp web-demo/privacy.html public/web-demo/privacy.html
cp web-demo/styles.css public/web-demo/styles.css

cat > public/robots.txt <<'EOF'
User-agent: *
Disallow:
EOF

cat > public/build-version.json <<EOF
{"buildId":"$BUILD_ID","createdAt":"$BUILD_CREATED_AT"}
EOF
