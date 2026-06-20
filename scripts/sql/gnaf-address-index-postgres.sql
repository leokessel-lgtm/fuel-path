CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS fuel_path_gnaf_addresses (
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

CREATE INDEX IF NOT EXISTS fuel_path_gnaf_addresses_search_trgm_idx
  ON fuel_path_gnaf_addresses
  USING gin (search_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS fuel_path_gnaf_addresses_search_prefix_idx
  ON fuel_path_gnaf_addresses (search_text text_pattern_ops);

CREATE INDEX IF NOT EXISTS fuel_path_gnaf_addresses_state_postcode_idx
  ON fuel_path_gnaf_addresses (state, postcode);

CREATE INDEX IF NOT EXISTS fuel_path_gnaf_addresses_locality_idx
  ON fuel_path_gnaf_addresses (locality);
