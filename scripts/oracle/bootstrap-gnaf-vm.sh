#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root with sudo." >&2
  exit 1
fi

source /etc/os-release

install_debian_packages() {
  apt-get update
  apt-get install -y ca-certificates curl gnupg git unzip postgresql postgresql-contrib caddy

  if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/^v//' | cut -d. -f1)" -lt 22 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  fi
}

install_oracle_linux_packages() {
  dnf install -y ca-certificates curl git unzip postgresql-server postgresql-contrib

  if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/^v//' | cut -d. -f1)" -lt 22 ]]; then
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
    dnf install -y nodejs
  fi

  if ! command -v caddy >/dev/null 2>&1; then
    dnf install -y 'dnf-command(copr)'
    dnf copr enable -y @caddy/caddy
    dnf install -y caddy
  fi

  if [[ ! -f /var/lib/pgsql/data/postgresql.conf ]]; then
    postgresql-setup --initdb
  fi

  sed -i \
    -e 's/^\(host[[:space:]]\+all[[:space:]]\+all[[:space:]]\+127\.0\.0\.1\/32[[:space:]]\+\)ident/\1md5/' \
    -e 's/^\(host[[:space:]]\+all[[:space:]]\+all[[:space:]]\+::1\/128[[:space:]]\+\)ident/\1md5/' \
    /var/lib/pgsql/data/pg_hba.conf

  systemctl enable --now postgresql
}

case "${ID}" in
  debian|ubuntu)
    install_debian_packages
    systemctl enable --now postgresql
    ;;
  ol)
    install_oracle_linux_packages
    ;;
  *)
    echo "Unsupported Linux distribution: ${PRETTY_NAME:-${ID}}" >&2
    exit 1
    ;;
esac

systemctl enable --now caddy

id -u fuelpath >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin fuelpath
mkdir -p /opt/fuel-path /etc/fuel-path
chown -R fuelpath:fuelpath /opt/fuel-path
chmod 750 /etc/fuel-path

sudo -u postgres psql <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'fuelpath') THEN
    CREATE ROLE fuelpath LOGIN PASSWORD 'change-this-password-before-loading';
  ELSE
    ALTER ROLE fuelpath WITH LOGIN PASSWORD 'change-this-password-before-loading';
  END IF;
END
$$;
SELECT 'CREATE DATABASE fuel_path_gnaf OWNER fuelpath'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fuel_path_gnaf')\gexec
\c fuel_path_gnaf
CREATE EXTENSION IF NOT EXISTS pg_trgm;
SQL

cat >/etc/fuel-path/gnaf-api.env.example <<'EOF'
PORT=8787
FUEL_PATH_GNAF_DATABASE_URL=postgres://fuelpath:change-this-password-before-loading@127.0.0.1:5432/fuel_path_gnaf
FUEL_PATH_GNAF_API_TOKEN=replace-with-a-long-random-token
FUEL_PATH_GNAF_API_POOL_SIZE=6
EOF

echo "Bootstrap complete."
echo "Copy /etc/fuel-path/gnaf-api.env.example to /etc/fuel-path/gnaf-api.env, replace both secrets, then load G-NAF and enable the systemd service."
