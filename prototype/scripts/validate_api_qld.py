#!/usr/bin/env python3
"""Validate Queensland Fuel Prices Direct Outbound API access."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DEFAULT_BASE_URL = "https://fppdirectapi-prod.fuelpricesqld.com.au"
DEFAULT_COUNTRY_ID = 21
DEFAULT_GEO_REGION_LEVEL = 3
DEFAULT_GEO_REGION_ID = 1
HTTP_TIMEOUT_SECONDS = 20


def load_env_file(path: Path) -> None:
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def api_get(
    *,
    base_url: str,
    token: str,
    path: str,
    params: dict[str, int],
) -> dict[str, Any]:
    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}?{urlencode(params)}"
    request = Request(
        url,
        headers={
            "Authorization": f"FPDAPI SubscriberToken={token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    with urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
        payload = response.read().decode("utf-8")
    return json.loads(payload)


def count_payload_rows(payload: dict[str, Any]) -> int:
    for value in payload.values():
        if isinstance(value, list):
            return len(value)
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env", type=Path, help="Optional env file, for example prototype/.env")
    parser.add_argument("--country-id", type=int, default=DEFAULT_COUNTRY_ID)
    parser.add_argument("--geo-region-level", type=int, default=DEFAULT_GEO_REGION_LEVEL)
    parser.add_argument("--geo-region-id", type=int, default=DEFAULT_GEO_REGION_ID)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.env:
        load_env_file(args.env)

    base_url = os.getenv("QLD_FUEL_API_BASE_URL", DEFAULT_BASE_URL).strip() or DEFAULT_BASE_URL
    token = require_env("QLD_FUEL_API_TOKEN")
    params = {
        "countryId": args.country_id,
        "geoRegionLevel": args.geo_region_level,
        "geoRegionId": args.geo_region_id,
    }

    site_details = api_get(
        base_url=base_url,
        token=token,
        path="/Subscriber/GetFullSiteDetails",
        params=params,
    )
    prices = api_get(
        base_url=base_url,
        token=token,
        path="/Price/GetSitesPrices",
        params=params,
    )

    print("QLD Fuel Prices API validation OK")
    print(f"Base URL: {base_url}")
    print(
        "Region: "
        f"countryId={args.country_id}, "
        f"geoRegionLevel={args.geo_region_level}, "
        f"geoRegionId={args.geo_region_id}"
    )
    print(f"Site detail rows: {count_payload_rows(site_details)}")
    print(f"Price rows: {count_payload_rows(prices)}")
    print(f"Site detail keys: {', '.join(sorted(site_details.keys()))}")
    print(f"Price keys: {', '.join(sorted(prices.keys()))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
