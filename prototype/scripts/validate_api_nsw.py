#!/usr/bin/env python3
"""
Validate registered API.NSW Fuel API credentials without exposing secrets.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_TOKEN_URL = "https://api.onegov.nsw.gov.au/oauth/client_credential/accesstoken"
DEFAULT_PRICES_URL = "https://api.onegov.nsw.gov.au/FuelPriceCheck/v1/fuel/prices"
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Safari/537.36"
)


def load_env_file(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Env file not found: {path}")
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


def redact(value: str, keep: int = 4) -> str:
    if len(value) <= keep:
        return "*" * len(value)
    return f"{value[:keep]}...{len(value)} chars"


def request_json(request: urllib.request.Request) -> dict[str, Any]:
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            body = response.read().decode("utf-8")
            status = response.status
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {body[:500]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Network error: {exc}") from exc

    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"HTTP {status} response was not JSON: {body[:300]}") from exc
    return payload


def with_query(url: str, params: dict[str, str]) -> str:
    parsed = urllib.parse.urlparse(url)
    query = dict(urllib.parse.parse_qsl(parsed.query, keep_blank_values=True))
    query.update(params)
    return urllib.parse.urlunparse(parsed._replace(query=urllib.parse.urlencode(query)))


def get_token(api_key: str, api_secret: str, token_url: str) -> str:
    encoded = base64.b64encode(f"{api_key}:{api_secret}".encode("utf-8")).decode("ascii")
    common_headers = {
        "Authorization": f"Basic {encoded}",
        "Accept": "application/json",
        "User-Agent": DEFAULT_USER_AGENT,
    }
    attempts = [
        (
            "GET query string",
            with_query(token_url, {"grant_type": "client_credentials"}),
            None,
            common_headers,
            "GET",
        ),
        (
            "form body",
            token_url,
            b"grant_type=client_credentials",
            {**common_headers, "Content-Type": "application/x-www-form-urlencoded"},
            "POST",
        ),
        (
            "POST query string",
            with_query(token_url, {"grant_type": "client_credentials"}),
            b"",
            {**common_headers, "Content-Type": "application/json"},
            "POST",
        ),
    ]
    failures: list[str] = []
    for label, url, data, headers, method in attempts:
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            payload = request_json(request)
        except RuntimeError as exc:
            failures.append(f"{label}: {exc}")
            continue
        token = payload.get("access_token") or payload.get("accessToken")
        if token:
            print("OAuth grant format:", label)
            return str(token)
        failures.append(f"{label}: response keys {sorted(payload)}")
    raise RuntimeError("OAuth response did not include access_token. " + " | ".join(failures))


def get_prices(api_key: str, token: str, prices_url: str) -> dict[str, Any]:
    request = urllib.request.Request(
        prices_url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json; charset=utf-8",
            "apikey": api_key,
            "transactionid": "fuel-path-api-validation",
            "requesttimestamp": datetime.now(timezone.utc).isoformat(),
            "User-Agent": DEFAULT_USER_AGENT,
        },
        method="GET",
    )
    return request_json(request)


def find_records(payload: Any) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    if isinstance(payload, dict):
        for value in payload.values():
            records.extend(find_records(value))
    elif isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                if looks_like_station_or_price(item):
                    records.append(item)
                else:
                    records.extend(find_records(item))
    return records


def looks_like_station_or_price(item: dict[str, Any]) -> bool:
    keys = {key.lower() for key in item}
    return bool(
        {
            "address",
            "brand",
            "code",
            "fuelcode",
            "fueltype",
            "location",
            "name",
            "price",
            "servicestationname",
            "stationcode",
            "stationname",
        }
        & keys
    )


def detect_act(records: list[dict[str, Any]]) -> tuple[int, list[str]]:
    matches: list[str] = []
    for record in records:
        text = " ".join(str(value) for value in record.values()).lower()
        if re.search(r"\bact\b|canberra", text):
            name = (
                record.get("ServiceStationName")
                or record.get("stationName")
                or record.get("stationname")
                or record.get("name")
                or "unknown"
            )
            matches.append(str(name))
    return len(matches), sorted(set(matches))[:10]


def redacted_payload(payload: Any) -> Any:
    if isinstance(payload, dict):
        redacted = {}
        for key, value in payload.items():
            if key.lower() in {"access_token", "accesstoken", "token", "apikey", "api_key"}:
                redacted[key] = "<redacted>"
            else:
                redacted[key] = redacted_payload(value)
        return redacted
    if isinstance(payload, list):
        return [redacted_payload(item) for item in payload[:20]]
    return payload


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate API.NSW Fuel API access.")
    parser.add_argument("--env", type=Path, help="Optional env file, for example prototype/.env")
    parser.add_argument("--save-sample", type=Path, help="Write a redacted JSON sample response")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)

    try:
        if args.env:
            load_env_file(args.env)

        api_key = require_env("NSW_FUEL_API_KEY")
        api_secret = require_env("NSW_FUEL_API_SECRET")
        token_url = os.getenv("NSW_FUEL_TOKEN_URL", DEFAULT_TOKEN_URL).strip() or DEFAULT_TOKEN_URL
        prices_url = os.getenv("NSW_FUEL_PRICES_URL", DEFAULT_PRICES_URL).strip() or DEFAULT_PRICES_URL

        print("API key:", redact(api_key))
        print("API secret:", redact(api_secret))
        print("Token URL:", token_url)
        print("Prices URL:", prices_url)

        token = get_token(api_key, api_secret, token_url)
        print("OAuth: OK")
        print("Access token:", redact(token))

        payload = get_prices(api_key, token, prices_url)
        print("Prices endpoint: OK")
        print("Top-level keys:", sorted(payload) if isinstance(payload, dict) else type(payload).__name__)

        records = find_records(payload)
        print("Detected station/price-like records:", len(records))
        act_count, act_examples = detect_act(records)
        print("Possible ACT records:", act_count)
        if act_examples:
            print("ACT examples:", ", ".join(act_examples))

        if args.save_sample:
            args.save_sample.parent.mkdir(parents=True, exist_ok=True)
            args.save_sample.write_text(
                json.dumps(redacted_payload(payload), indent=2),
                encoding="utf-8",
            )
            print("Saved redacted sample:", args.save_sample)
    except Exception as exc:
        print(f"Validation failed: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
