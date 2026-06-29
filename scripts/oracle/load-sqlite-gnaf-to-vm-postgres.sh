#!/usr/bin/env bash
set -euo pipefail

SQLITE_PATH="${SQLITE_PATH:-data/gnaf/build/gnaf-addresses-national.sqlite}"
VM_HOST="${VM_HOST:-152.69.175.222}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/fuel_path_oracle_gnaf_ed25519}"
LIMIT_ROWS="${LIMIT_ROWS:-0}"
RESET_TABLE="${RESET_TABLE:-false}"
CREATE_INDEXES="${CREATE_INDEXES:-false}"

if [[ ! -f "${SQLITE_PATH}" ]]; then
  echo "SQLite file does not exist: ${SQLITE_PATH}" >&2
  exit 1
fi

copy_columns="id,label,lat,lon,state,postcode,accuracy,locality,alias_principal,primary_secondary,geocode_type,search_text"
select_sql="SELECT id,label,lat,lon,state,postcode,accuracy,locality,alias_principal,primary_secondary,geocode_type,search_text FROM addresses"
if [[ "${LIMIT_ROWS}" != "0" ]]; then
  select_sql="${select_sql} LIMIT ${LIMIT_ROWS}"
fi

if [[ "${RESET_TABLE}" == "true" ]]; then
  ssh -i "${SSH_KEY}" "opc@${VM_HOST}" "sudo -u postgres psql -d fuel_path_gnaf -v ON_ERROR_STOP=1" <<'SQL'
DROP TABLE IF EXISTS fuel_path_gnaf_addresses;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE fuel_path_gnaf_addresses (
  id text PRIMARY KEY,
  label text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  state text,
  postcode text,
  accuracy text,
  locality text,
  alias_principal text,
  primary_secondary text,
  geocode_type text,
  search_text text NOT NULL
);
ALTER TABLE fuel_path_gnaf_addresses OWNER TO fuelpath;
GRANT SELECT ON fuel_path_gnaf_addresses TO fuelpath;
SQL
fi

sqlite3 -readonly -csv "${SQLITE_PATH}" "${select_sql}" |
  ssh -i "${SSH_KEY}" "opc@${VM_HOST}" \
    "sudo -u postgres psql -d fuel_path_gnaf -v ON_ERROR_STOP=1 -c \"COPY fuel_path_gnaf_addresses (${copy_columns}) FROM STDIN WITH (FORMAT csv)\""

if [[ "${CREATE_INDEXES}" == "true" ]]; then
  ssh -i "${SSH_KEY}" "opc@${VM_HOST}" "sudo -u postgres psql -d fuel_path_gnaf -v ON_ERROR_STOP=1" <<'SQL'
CREATE INDEX IF NOT EXISTS fuel_path_gnaf_addresses_search_trgm_idx
  ON fuel_path_gnaf_addresses
  USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS fuel_path_gnaf_addresses_search_prefix_idx
  ON fuel_path_gnaf_addresses (search_text text_pattern_ops);
CREATE INDEX IF NOT EXISTS fuel_path_gnaf_addresses_state_postcode_idx
  ON fuel_path_gnaf_addresses (state, postcode);
CREATE INDEX IF NOT EXISTS fuel_path_gnaf_addresses_locality_idx
  ON fuel_path_gnaf_addresses (locality);
ANALYSE fuel_path_gnaf_addresses;
ALTER TABLE fuel_path_gnaf_addresses OWNER TO fuelpath;
GRANT SELECT ON fuel_path_gnaf_addresses TO fuelpath;
SQL
fi
