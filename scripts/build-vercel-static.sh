#!/bin/sh
set -eu

rm -rf public

cd mobile-app
EXPO_PUBLIC_FUEL_PATH_API_BASE_URL=__SAME_ORIGIN__ npm_config_cache=.npm-cache npx expo export --platform web --output-dir ../public
cd ..

cat > public/robots.txt <<'EOF'
User-agent: *
Disallow:
EOF
