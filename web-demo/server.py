#!/usr/bin/env python3
"""
Local Fuel Path demo server.

Serves the static web demo and keeps API.NSW credentials server-side.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote, urlencode, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "prototype" / "scripts"
GNAF_SEED_PATH = ROOT / "prototype" / "data" / "gnaf-addresses.seed.json"
sys.path.insert(0, str(SCRIPTS_DIR))

from score_route import DATA_DIR  # noqa: E402
from score_route import Candidate  # noqa: E402
from score_route import Point  # noqa: E402
from score_route import haversine_km  # noqa: E402
from score_route import load_json  # noqa: E402
from score_route import load_live_nsw_prices  # noqa: E402
from score_route import normalise_qld_payload  # noqa: E402
from score_route import nearest_route_position  # noqa: E402
from score_route import route_points  # noqa: E402
from score_route import score_candidates_adaptive  # noqa: E402


SAMPLE_NOW = datetime.fromisoformat("2026-06-13T08:00:00+10:00")
DEFAULT_CACHE_SECONDS = 300
GEOCODE_CACHE_SECONDS = 60 * 60 * 6
GEOCODE_DEGRADED_CACHE_SECONDS = 60
NOMINATIM_RATE_LIMIT_BACKOFF_SECONDS = 60
HTTP_TIMEOUT_SECONDS = 12
USER_AGENT = "FuelPathDemo/0.1 local validation"
RECOMMENDED_GEOCODE_PROVIDER = "google_places_autocomplete_new"
DEFAULT_QLD_FUEL_API_BASE_URL = "https://fppdirectapi-prod.fuelpricesqld.com.au"
DEFAULT_WA_FUELWATCH_RSS_URL = "https://www.fuelwatch.wa.gov.au/fuelwatch/fuelWatchRSS"
QLD_REGION_PARAMS = {
    "countryId": 21,
    "geoRegionLevel": 3,
    "geoRegionId": 1,
}
QLD_BOUNDS = {
    "min_lat": -29.5,
    "max_lat": -9.0,
    "min_lon": 137.0,
    "max_lon": 154.2,
}
NSW_BOUNDS = {
    "min_lat": -37.7,
    "max_lat": -28.0,
    "min_lon": 140.9,
    "max_lon": 154.2,
}
WA_BOUNDS = {
    "min_lat": -36.0,
    "max_lat": -13.0,
    "min_lon": 112.0,
    "max_lon": 129.5,
}
VIC_BOUNDS = {
    "min_lat": -39.3,
    "max_lat": -33.9,
    "min_lon": 140.9,
    "max_lon": 150.2,
}
ACT_BOUNDS = {
    "min_lat": -35.95,
    "max_lat": -35.1,
    "min_lon": 148.7,
    "max_lon": 149.45,
}
NSW_VIC_BORDER_POINTS = [
    {"lon": 141.0, "lat": -34.0},
    {"lon": 142.2, "lat": -34.18},
    {"lon": 143.6, "lat": -35.35},
    {"lon": 144.75, "lat": -36.12},
    {"lon": 146.0, "lat": -35.998},
    {"lon": 146.45, "lat": -36.03},
    {"lon": 146.9, "lat": -36.08},
    {"lon": 148.25, "lat": -36.65},
    {"lon": 149.98, "lat": -37.5},
]
WA_FUELWATCH_PRODUCTS = {
    "U91": 1,
    "P95": 2,
    "DL": 4,
    "LPG": 5,
    "P98": 6,
    "E85": 10,
    "PDL": 11,
}
WA_DEFAULT_METRO_REGION_IDS = [25, 26, 27]
WA_FUELWATCH_REGIONS = [
    {"id": 1, "name": "Boulder", "lat": -30.782, "lon": 121.491},
    {"id": 2, "name": "Broome", "lat": -17.961, "lon": 122.236},
    {"id": 3, "name": "Busselton Townsite", "lat": -33.652, "lon": 115.345},
    {"id": 4, "name": "Carnarvon", "lat": -24.884, "lon": 113.657},
    {"id": 5, "name": "Collie", "lat": -33.36, "lon": 116.156},
    {"id": 6, "name": "Dampier", "lat": -20.662, "lon": 116.711},
    {"id": 7, "name": "Esperance", "lat": -33.86, "lon": 121.889},
    {"id": 8, "name": "Kalgoorlie", "lat": -30.749, "lon": 121.466},
    {"id": 9, "name": "Karratha", "lat": -20.736, "lon": 116.846},
    {"id": 10, "name": "Kununurra", "lat": -15.779, "lon": 128.741},
    {"id": 11, "name": "Narrogin", "lat": -32.933, "lon": 117.178},
    {"id": 12, "name": "Northam", "lat": -31.653, "lon": 116.671},
    {"id": 13, "name": "Port Hedland", "lat": -20.312, "lon": 118.61},
    {"id": 14, "name": "South Hedland", "lat": -20.407, "lon": 118.6},
    {"id": 15, "name": "Albany", "lat": -35.027, "lon": 117.884},
    {"id": 16, "name": "Bunbury", "lat": -33.327, "lon": 115.641},
    {"id": 17, "name": "Geraldton", "lat": -28.777, "lon": 114.614},
    {"id": 18, "name": "Mandurah", "lat": -32.536, "lon": 115.743},
    {"id": 19, "name": "Capel", "lat": -33.558, "lon": 115.562},
    {"id": 20, "name": "Dardanup", "lat": -33.397, "lon": 115.755},
    {"id": 21, "name": "Greenough", "lat": -28.956, "lon": 114.735},
    {"id": 22, "name": "Harvey", "lat": -33.08, "lon": 115.893},
    {"id": 23, "name": "Murray", "lat": -32.629, "lon": 115.874},
    {"id": 24, "name": "Waroona", "lat": -32.844, "lon": 115.923},
    {"id": 25, "name": "Metro North of River", "lat": -31.89, "lon": 115.84},
    {"id": 26, "name": "Metro South of River", "lat": -32.08, "lon": 115.86},
    {"id": 27, "name": "Metro East/Hills", "lat": -31.98, "lon": 116.03},
    {"id": 28, "name": "Augusta Margaret River", "lat": -33.953, "lon": 115.073},
    {"id": 29, "name": "Busselton Shire", "lat": -33.652, "lon": 115.345},
    {"id": 30, "name": "Bridgetown Greenbushes", "lat": -33.959, "lon": 116.137},
    {"id": 31, "name": "Donnybrook Balingup", "lat": -33.572, "lon": 115.824},
    {"id": 32, "name": "Manjimup", "lat": -34.241, "lon": 116.146},
    {"id": 33, "name": "Cataby", "lat": -30.744, "lon": 115.551},
    {"id": 34, "name": "Coolgardie", "lat": -30.954, "lon": 121.163},
    {"id": 35, "name": "Cunderdin", "lat": -31.652, "lon": 117.242},
    {"id": 36, "name": "Dalwallinu", "lat": -30.278, "lon": 116.66},
    {"id": 37, "name": "Denmark", "lat": -34.961, "lon": 117.353},
    {"id": 38, "name": "Derby", "lat": -17.303, "lon": 123.629},
    {"id": 39, "name": "Dongara", "lat": -29.252, "lon": 114.932},
    {"id": 40, "name": "Exmouth", "lat": -21.93, "lon": 114.126},
    {"id": 41, "name": "Fitzroy Crossing", "lat": -18.197, "lon": 125.567},
    {"id": 42, "name": "Jurien", "lat": -30.305, "lon": 115.039},
    {"id": 43, "name": "Kambalda", "lat": -31.206, "lon": 121.66},
    {"id": 44, "name": "Kellerberrin", "lat": -31.634, "lon": 117.72},
    {"id": 45, "name": "Kojonup", "lat": -33.833, "lon": 117.159},
    {"id": 46, "name": "Meekatharra", "lat": -26.593, "lon": 118.495},
    {"id": 47, "name": "Moora", "lat": -30.64, "lon": 116.008},
    {"id": 48, "name": "Mount Barker", "lat": -34.63, "lon": 117.666},
    {"id": 49, "name": "Newman", "lat": -23.357, "lon": 119.735},
    {"id": 50, "name": "Norseman", "lat": -32.197, "lon": 121.779},
    {"id": 51, "name": "Ravensthorpe", "lat": -33.582, "lon": 120.046},
    {"id": 53, "name": "Tammin", "lat": -31.641, "lon": 117.484},
    {"id": 54, "name": "Williams", "lat": -33.027, "lon": 116.88},
    {"id": 55, "name": "Wubin", "lat": -30.106, "lon": 116.629},
    {"id": 56, "name": "York", "lat": -31.888, "lon": 116.769},
    {"id": 57, "name": "Regans Ford", "lat": -30.98, "lon": 115.695},
    {"id": 58, "name": "Meckering", "lat": -31.632, "lon": 117.008},
    {"id": 59, "name": "Wundowie", "lat": -31.76, "lon": 116.379},
    {"id": 60, "name": "North Bannister", "lat": -32.582, "lon": 116.451},
    {"id": 61, "name": "Munglinup", "lat": -33.714, "lon": 120.865},
    {"id": 62, "name": "Northam Shire", "lat": -31.653, "lon": 116.671},
    {"id": 63, "name": "Bodallin", "lat": -31.37, "lon": 118.861},
]
GEOCODE_PROVIDER_ALIASES = {
    "auto": "auto",
    "google": "google",
    "google_places": "google",
    "google_places_autocomplete_new": "google",
    "mapbox": "mapbox",
    "here": "here",
    "geoapify": "geoapify",
    "nominatim": "nominatim",
}
GEOCODE_QUERY_CORRECTIONS = {
    "artamon": "artarmon",
}
LOCAL_GEOCODE_HINTS = [
    {
        "label": "66B Easton Avenue, Sylvania NSW 2224",
        "lat": -34.0114122,
        "lon": 151.0993847,
        "kind": "address",
        "aliases": ["66b eas", "66b east", "easton", "easton ave", "easton avenue sylvania"],
    },
    {
        "label": "Sydney Opera House, Bennelong Point NSW 2000",
        "lat": -33.8567844,
        "lon": 151.2152967,
        "kind": "poi",
        "aliases": ["opera", "opera house", "sydney opera"],
    },
    {
        "label": "Sydney CBD, Sydney NSW",
        "lat": -33.8747234,
        "lon": 151.2053644,
        "kind": "suburb",
        "aliases": ["sydney cbd", "cbd sydney", "city sydney"],
    },
    {
        "label": "Sydney Harbour Bridge, Sydney NSW",
        "lat": -33.8523063,
        "lon": 151.2107871,
        "kind": "poi",
        "aliases": ["harbour bridge", "sydney harbour bridge"],
    },
    {
        "label": "Bondi Beach, Bondi NSW 2026",
        "lat": -33.8914755,
        "lon": 151.2766845,
        "kind": "poi",
        "aliases": ["bondi", "bondi beach"],
    },
    {
        "label": "Sydney Airport, Mascot NSW 2020",
        "lat": -33.9399228,
        "lon": 151.1752764,
        "kind": "airport",
        "aliases": ["sydney airport", "kingsford smith airport", "mascot airport"],
    },
    {
        "label": "Westfield Parramatta, Parramatta NSW 2150",
        "lat": -33.817986,
        "lon": 151.001057,
        "kind": "poi",
        "aliases": ["westfield parramatta", "parramatta westfield"],
    },
    {
        "label": "Canberra ACT",
        "lat": -35.2975906,
        "lon": 149.1012676,
        "kind": "city",
        "aliases": ["canberra", "canberra act"],
    },
    {
        "label": "Canberra Centre, Canberra ACT 2601",
        "lat": -35.279341,
        "lon": 149.133663,
        "kind": "poi",
        "aliases": ["canberra centre"],
    },
    {
        "label": "Melbourne CBD, Melbourne VIC",
        "lat": -37.8136276,
        "lon": 144.9630576,
        "kind": "city",
        "aliases": ["melbourne", "melbourne cbd", "city melbourne"],
    },
    {
        "label": "Melbourne Central, Melbourne VIC 3000",
        "lat": -37.810064,
        "lon": 144.962792,
        "kind": "poi",
        "aliases": ["melbourne central"],
    },
    {
        "label": "Flinders Street Station, Melbourne VIC 3000",
        "lat": -37.818305,
        "lon": 144.966964,
        "kind": "poi",
        "aliases": ["flinders street station", "flinders st station"],
    },
    {
        "label": "Queen Victoria Market, Melbourne VIC 3000",
        "lat": -37.807579,
        "lon": 144.956785,
        "kind": "poi",
        "aliases": ["queen victoria market", "qvm"],
    },
    {
        "label": "Melbourne Cricket Ground, East Melbourne VIC 3002",
        "lat": -37.819967,
        "lon": 144.983449,
        "kind": "poi",
        "aliases": ["mcg", "melbourne cricket ground"],
    },
    {
        "label": "Melbourne Airport, Tullamarine VIC 3045",
        "lat": -37.669012,
        "lon": 144.841027,
        "kind": "airport",
        "aliases": ["melbourne airport", "tullamarine airport"],
    },
    {
        "label": "Brisbane CBD, Brisbane QLD",
        "lat": -27.4697707,
        "lon": 153.0251235,
        "kind": "city",
        "aliases": ["brisbane", "brisbane cbd", "city brisbane"],
    },
    {
        "label": "South Bank, Brisbane QLD 4101",
        "lat": -27.481079,
        "lon": 153.023379,
        "kind": "poi",
        "aliases": ["south bank brisbane", "southbank brisbane"],
    },
    {
        "label": "Queen Street Mall, Brisbane QLD 4000",
        "lat": -27.470849,
        "lon": 153.024475,
        "kind": "poi",
        "aliases": ["queen street mall", "queen street mall brisbane"],
    },
    {
        "label": "Brisbane Airport, Brisbane Airport QLD 4008",
        "lat": -27.384199,
        "lon": 153.1175,
        "kind": "airport",
        "aliases": ["brisbane airport"],
    },
    {
        "label": "Perth CBD, Perth WA",
        "lat": -31.9523123,
        "lon": 115.861309,
        "kind": "city",
        "aliases": ["perth", "perth cbd", "city perth"],
    },
    {
        "label": "Elizabeth Quay, Perth WA 6000",
        "lat": -31.958647,
        "lon": 115.857494,
        "kind": "poi",
        "aliases": ["elizabeth quay", "elizabeth quay perth"],
    },
    {
        "label": "Perth Airport, Perth Airport WA 6105",
        "lat": -31.940299,
        "lon": 115.966904,
        "kind": "airport",
        "aliases": ["perth airport"],
    },
    {
        "label": "Adelaide CBD, Adelaide SA",
        "lat": -34.9284989,
        "lon": 138.6007456,
        "kind": "city",
        "aliases": ["adelaide", "adelaide cbd", "city adelaide"],
    },
    {
        "label": "Rundle Mall, Adelaide SA 5000",
        "lat": -34.922776,
        "lon": 138.602686,
        "kind": "poi",
        "aliases": ["rundle mall", "rundle mall adelaide"],
    },
    {
        "label": "Adelaide Airport, Adelaide Airport SA 5950",
        "lat": -34.945,
        "lon": 138.530556,
        "kind": "airport",
        "aliases": ["adelaide airport"],
    },
    {
        "label": "Hobart CBD, Hobart TAS",
        "lat": -42.8821377,
        "lon": 147.3271949,
        "kind": "city",
        "aliases": ["hobart", "hobart cbd", "city hobart"],
    },
    {
        "label": "Salamanca Market, Hobart TAS 7000",
        "lat": -42.886438,
        "lon": 147.33174,
        "kind": "poi",
        "aliases": ["salamanca market", "salamanca hobart"],
    },
    {
        "label": "Hobart Airport, Cambridge TAS 7170",
        "lat": -42.836111,
        "lon": 147.510278,
        "kind": "airport",
        "aliases": ["hobart airport"],
    },
    {
        "label": "Darwin CBD, Darwin NT",
        "lat": -12.46344,
        "lon": 130.845642,
        "kind": "city",
        "aliases": ["darwin", "darwin cbd", "city darwin"],
    },
    {
        "label": "Darwin Waterfront, Darwin NT 0800",
        "lat": -12.466762,
        "lon": 130.846361,
        "kind": "poi",
        "aliases": ["darwin waterfront", "waterfront darwin"],
    },
    {
        "label": "Darwin Airport, Eaton NT 0820",
        "lat": -12.414722,
        "lon": 130.876667,
        "kind": "airport",
        "aliases": ["darwin airport"],
    },
]
GEOCODE_CACHE: dict[str, dict[str, Any]] = {}
NOMINATIM_BLOCKED_UNTIL = 0.0
GNAF_SEED_RECORDS: list[dict[str, Any]] | None = None
STREET_QUERY_PATTERN = re.compile(
    r"^(.+\b(?:street|st|road|rd|avenue|ave|drive|dr|parade|pde|place|pl|lane|ln|way|crescent|cres)\b)\b.*$",
    re.IGNORECASE,
)
PARTIAL_STREET_QUERY_PATTERN = re.compile(r"^(\d+[a-z]?\s+[a-z][a-z\s'-]{2,})$", re.IGNORECASE)
STREET_TYPE_EXPANSIONS = ["street", "road", "avenue", "drive", "parade", "place", "lane", "way"]
STATION_QUERY_TERMS = [
    "7 eleven",
    "ampol",
    "bp",
    "caltex",
    "coles express",
    "eg",
    "fuel",
    "metro",
    "mobil",
    "petrol",
    "reddy",
    "service station",
    "servo",
    "shell",
    "united",
    "woolworths",
]
DISCOUNT_RULES = [
    {
        "id": "everyday_rewards",
        "label": "Everyday Rewards",
        "centsPerLitre": 4.0,
        "brandIncludes": ["eg ampol", "ampol", "caltex"],
    },
    {
        "id": "flybuys",
        "label": "Flybuys docket",
        "centsPerLitre": 4.0,
        "brandIncludes": ["shell", "reddy", "coles express"],
    },
    {
        "id": "nrma_ampol",
        "label": "NRMA / Ampol",
        "centsPerLitre": 5.0,
        "brandIncludes": ["ampol", "caltex"],
    },
    {
        "id": "fleet_card",
        "label": "Fleet card",
        "centsPerLitre": 3.0,
        "brandIncludes": ["ampol", "caltex", "bp", "shell", "reddy", "united", "metro", "mobil"],
    },
    {
        "id": "linkt_rewards",
        "label": "Linkt Rewards",
        "centsPerLitre": 6.0,
        "brandIncludes": ["7-eleven"],
    },
    {
        "id": "linkt_bonus",
        "label": "Linkt toll-trip bonus",
        "centsPerLitre": 26.0,
        "brandIncludes": ["7-eleven"],
    },
]

LIVE_CACHE: dict[str, Any] = {
    "stations": None,
    "loaded_at": 0.0,
}
QLD_LIVE_CACHE: dict[str, Any] = {
    "stations": None,
    "loaded_at": 0.0,
}
WA_LIVE_CACHE: dict[str, Any] = {
    "entries": {},
}


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


def has_live_credentials() -> bool:
    return bool(os.getenv("NSW_FUEL_API_KEY") and os.getenv("NSW_FUEL_API_SECRET"))


def has_qld_credentials() -> bool:
    return bool(os.getenv("QLD_FUEL_API_TOKEN"))


def has_wa_provider() -> bool:
    return os.getenv("FUEL_PATH_WA_FUELWATCH_ENABLED") != "0"


def has_vic_credentials() -> bool:
    return bool(os.getenv("VIC_SERVO_SAVER_API_BASE_URL") and os.getenv("VIC_SERVO_SAVER_API_KEY"))


def has_any_live_credentials() -> bool:
    return has_live_credentials() or has_qld_credentials() or has_wa_provider() or has_vic_credentials()


def google_maps_api_key() -> str:
    return os.getenv("FUEL_PATH_GOOGLE_MAPS_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY") or ""


def google_places_api_key() -> str:
    return os.getenv("FUEL_PATH_GOOGLE_PLACES_API_KEY") or google_maps_api_key()


def mapbox_access_token() -> str:
    return os.getenv("FUEL_PATH_MAPBOX_ACCESS_TOKEN") or os.getenv("MAPBOX_ACCESS_TOKEN") or ""


def here_api_key() -> str:
    return os.getenv("FUEL_PATH_HERE_API_KEY") or os.getenv("HERE_API_KEY") or ""


def geoapify_api_key() -> str:
    return os.getenv("FUEL_PATH_GEOAPIFY_API_KEY") or os.getenv("GEOAPIFY_API_KEY") or ""


def geocode_provider_status() -> dict[str, Any]:
    requested = os.getenv("FUEL_PATH_GEOCODE_PROVIDER", "nominatim")
    active = select_geocode_provider(requested, allow_fallback=True)
    return {
        "activeProvider": active,
        "activeMode": "validation" if active == "nominatim" else "production_candidate",
        "recommendedProductionProvider": RECOMMENDED_GEOCODE_PROVIDER,
        "requestedProvider": requested,
        "supportedProviders": ["google", "mapbox", "here", "geoapify", "nominatim"],
        "fallbackProvider": "nominatim",
        "addressIndex": address_index_status(),
        "backendProxyRequired": True,
        "sessionTokenRequired": True,
        "googlePlacesConfigured": bool(google_places_api_key()),
        "mapboxConfigured": bool(mapbox_access_token()),
        "hereConfigured": bool(here_api_key()),
        "geoapifyConfigured": bool(geoapify_api_key()),
    }


def get_param(params: dict[str, list[str]], name: str, default: str) -> str:
    values = params.get(name)
    if not values:
        return default
    return values[0]


def float_param(params: dict[str, list[str]], name: str, default: float) -> float:
    try:
        return float(get_param(params, name, str(default)))
    except ValueError:
        return default


def bool_param(params: dict[str, list[str]], name: str, default: bool = False) -> bool:
    value = get_param(params, name, "1" if default else "0").lower()
    return value in {"1", "true", "yes", "on"}


def int_param(params: dict[str, list[str]], name: str, default: int) -> int:
    try:
        return int(float(get_param(params, name, str(default))))
    except ValueError:
        return default


def set_param(params: dict[str, list[str]], name: str) -> set[str]:
    return {
        item.strip()
        for item in get_param(params, name, "").split(",")
        if item.strip()
    }


def load_sample_stations() -> list[dict[str, Any]]:
    return load_json(DATA_DIR / "sample-stations.json")["stations"]


def load_routes() -> list[dict[str, Any]]:
    return load_json(DATA_DIR / "routes.json")["routes"]


def load_live_stations(*, force_refresh: bool = False) -> list[dict[str, Any]]:
    api_key = os.getenv("NSW_FUEL_API_KEY")
    api_secret = os.getenv("NSW_FUEL_API_SECRET")
    if not api_key or not api_secret:
        raise RuntimeError("Live mode needs NSW_FUEL_API_KEY and NSW_FUEL_API_SECRET.")

    ttl = int(os.getenv("FUEL_PATH_LIVE_CACHE_SECONDS", str(DEFAULT_CACHE_SECONDS)))
    now = time.time()
    cached = LIVE_CACHE.get("stations")
    if (
        not force_refresh
        and cached is not None
        and now - float(LIVE_CACHE.get("loaded_at", 0.0)) < ttl
    ):
        return cached

    stations = load_live_nsw_prices(api_key, api_secret)
    LIVE_CACHE["stations"] = stations
    LIVE_CACHE["loaded_at"] = now
    return stations


def qld_api_get(path: str, params: dict[str, int]) -> dict[str, Any]:
    token = os.getenv("QLD_FUEL_API_TOKEN", "").strip()
    if not token:
        raise RuntimeError("QLD fuel API token is not configured.")
    base_url = (
        os.getenv("QLD_FUEL_API_BASE_URL", DEFAULT_QLD_FUEL_API_BASE_URL).strip()
        or DEFAULT_QLD_FUEL_API_BASE_URL
    )
    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}?{urlencode(params)}"
    request = Request(
        url,
        headers={
            "Authorization": f"FPDAPI SubscriberToken={token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    with urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def load_live_qld_stations(*, force_refresh: bool = False) -> list[dict[str, Any]]:
    ttl = int(os.getenv("FUEL_PATH_LIVE_CACHE_SECONDS", str(DEFAULT_CACHE_SECONDS)))
    now = time.time()
    cached = QLD_LIVE_CACHE.get("stations")
    if (
        not force_refresh
        and cached is not None
        and now - float(QLD_LIVE_CACHE.get("loaded_at", 0.0)) < ttl
    ):
        return cached

    brands = qld_api_get("/Subscriber/GetCountryBrands", {"countryId": 21})
    regions = qld_api_get("/Subscriber/GetCountryGeographicRegions", {"countryId": 21})
    sites = qld_api_get("/Subscriber/GetFullSiteDetails", QLD_REGION_PARAMS)
    prices = qld_api_get("/Price/GetSitesPrices", QLD_REGION_PARAMS)
    stations = normalise_qld_payload(sites, prices, brands, regions)
    QLD_LIVE_CACHE["stations"] = stations
    QLD_LIVE_CACHE["loaded_at"] = now
    return stations


def load_live_wa_stations(
    *,
    force_refresh: bool = False,
    points: list[Point] | None = None,
    radius_km: float = 0.0,
) -> list[dict[str, Any]]:
    if not has_wa_provider():
        raise RuntimeError("WA FuelWatch provider is disabled.")

    region_ids = wa_region_ids_for_area(points or [], radius_km=radius_km)
    cache_key = ",".join(str(region_id) for region_id in region_ids)
    ttl = int(os.getenv("FUEL_PATH_LIVE_CACHE_SECONDS", str(DEFAULT_CACHE_SECONDS)))
    now = time.time()
    entries = WA_LIVE_CACHE.setdefault("entries", {})
    cached = entries.get(cache_key)
    if (
        not force_refresh
        and cached is not None
        and now - float(cached.get("loaded_at", 0.0)) < ttl
    ):
        return cached["stations"]

    payloads = [
        (fuel_code, fetch_wa_fuelwatch_rss(product_id, region_id))
        for region_id in region_ids
        for fuel_code, product_id in WA_FUELWATCH_PRODUCTS.items()
    ]
    stations = normalise_wa_fuelwatch_payloads(payloads)
    entries[cache_key] = {"stations": stations, "loaded_at": now}
    return stations


def wa_region_ids_for_area(points: list[Point], *, radius_km: float = 0.0) -> list[int]:
    wa_points = sample_points_for_provider([point for point in points if point_in_wa(point)], 28)
    if not wa_points:
        return list(WA_DEFAULT_METRO_REGION_IDS)

    region_ids: set[int] = set()
    perth = Point(lat=-31.9523, lon=115.8613)
    search_km = max(35.0, min(120.0, float(radius_km or 0.0) * 2.0))
    for point in wa_points:
        if haversine_km(point, perth) <= 85.0:
            region_ids.update(WA_DEFAULT_METRO_REGION_IDS)

        ranked = sorted(
            (
                (haversine_km(point, Point(lat=region["lat"], lon=region["lon"])), int(region["id"]))
                for region in WA_FUELWATCH_REGIONS
            ),
            key=lambda item: item[0],
        )
        if ranked:
            region_ids.add(ranked[0][1])
        for distance_km, region_id in ranked:
            if distance_km <= search_km:
                region_ids.add(region_id)

    return sorted(region_ids)


def sample_points_for_provider(points: list[Point], limit: int) -> list[Point]:
    if len(points) <= limit:
        return points
    sampled: list[Point] = []
    previous_index = -1
    for index in range(limit):
        source_index = round((index / (limit - 1)) * (len(points) - 1))
        if source_index != previous_index:
            sampled.append(points[source_index])
            previous_index = source_index
    return sampled


def fetch_wa_fuelwatch_rss(product_id: int, region_id: int) -> bytes:
    base_url = os.getenv("WA_FUELWATCH_RSS_URL", DEFAULT_WA_FUELWATCH_RSS_URL)
    url = f"{base_url}?{urlencode({'Product': product_id, 'Region': region_id})}"
    request = Request(
        url,
        headers={
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
            "User-Agent": USER_AGENT,
        },
    )
    with urlopen(request, timeout=30) as response:
        return response.read().lstrip(b"\xef\xbb\xbf")


def normalise_wa_fuelwatch_payloads(payloads: list[tuple[str, bytes]]) -> list[dict[str, Any]]:
    stations: dict[str, dict[str, Any]] = {}
    for fuel_code, payload in payloads:
        root = ET.fromstring(payload)
        for item in root.findall("./channel/item"):
            row = {child.tag: (child.text or "").strip() for child in item}
            try:
                lat = float(row.get("latitude") or 0)
                lon = float(row.get("longitude") or 0)
                price = float(row.get("price") or "nan")
            except ValueError:
                continue
            if not lat or not lon or price != price:
                continue
            station_code = wa_station_code(row)
            station = stations.setdefault(
                station_code,
                {
                    "stationCode": station_code,
                    "name": row.get("trading-name") or re.sub(r"^[0-9.]+:\s*", "", row.get("title") or ""),
                    "brand": row.get("brand") or "Unknown",
                    "suburb": title_case(row.get("location") or ""),
                    "address": ", ".join(
                        item
                        for item in [row.get("address"), row.get("location"), "WA"]
                        if item
                    ),
                    "phone": row.get("phone") or None,
                    "lat": lat,
                    "lon": lon,
                    "openNow": wa_open_now(row.get("site-features")),
                    "membershipRequired": wa_membership_required(row.get("restrictions")),
                    "updatedAt": normalise_wa_date(row.get("date")),
                    "source": "api_wa_fuelwatch",
                    "prices": {},
                    "discounts": [],
                },
            )
            station["prices"][fuel_code] = price
            updated_at = normalise_wa_date(row.get("date"))
            if updated_at and (not station.get("updatedAt") or updated_at > str(station["updatedAt"])):
                station["updatedAt"] = updated_at

    return [station for station in stations.values() if station.get("prices")]


def wa_station_code(row: dict[str, str]) -> str:
    raw = "|".join(
        [
            row.get("brand", ""),
            row.get("trading-name", ""),
            row.get("address", ""),
            row.get("location", ""),
        ]
    )
    slug = re.sub(r"[^a-z0-9]+", "-", raw.lower().replace("&", "and")).strip("-")[:80]
    fallback = f"{row.get('latitude')}-{row.get('longitude')}"
    return f"WA-{slug or fallback}"


def normalise_wa_date(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(f"{value}T06:00:00+08:00").astimezone(timezone.utc).isoformat()
    except ValueError:
        return None


def wa_open_now(site_features: str | None) -> bool | None:
    if site_features and re.search(r"open\s+24\s+hours", site_features, re.IGNORECASE):
        return True
    return None


def wa_membership_required(restrictions: str | None) -> bool:
    return bool(re.search(r"member|membership|card\s+only", restrictions or "", re.IGNORECASE))


def title_case(value: str) -> str:
    return str(value or "").lower().title()


def load_live_vic_stations(*, force_refresh: bool = False) -> list[dict[str, Any]]:
    _ = force_refresh
    if not has_vic_credentials():
        raise RuntimeError(
            "VIC Servo Saver API access is not configured. Apply for API access before enabling live VIC prices."
        )
    raise RuntimeError("VIC Servo Saver API adapter needs the approved API schema before it can be enabled.")


def point_in_qld(point: Point) -> bool:
    return (
        QLD_BOUNDS["min_lat"] <= point.lat <= QLD_BOUNDS["max_lat"]
        and QLD_BOUNDS["min_lon"] <= point.lon <= QLD_BOUNDS["max_lon"]
    )


def point_in_wa(point: Point) -> bool:
    return (
        WA_BOUNDS["min_lat"] <= point.lat <= WA_BOUNDS["max_lat"]
        and WA_BOUNDS["min_lon"] <= point.lon <= WA_BOUNDS["max_lon"]
    )


def point_in_vic(point: Point) -> bool:
    if point_in_act(point):
        return False
    if not (
        VIC_BOUNDS["min_lat"] <= point.lat <= VIC_BOUNDS["max_lat"]
        and VIC_BOUNDS["min_lon"] <= point.lon <= VIC_BOUNDS["max_lon"]
    ):
        return False
    border_lat = nsw_vic_border_lat_at_lon(point.lon)
    if border_lat is not None:
        return point.lat < border_lat
    first = NSW_VIC_BORDER_POINTS[0]
    last = NSW_VIC_BORDER_POINTS[-1]
    if point.lon > last["lon"]:
        return point.lat <= last["lat"]
    if point.lon < first["lon"]:
        return point.lat < first["lat"]
    return True


def point_in_act(point: Point) -> bool:
    return (
        ACT_BOUNDS["min_lat"] <= point.lat <= ACT_BOUNDS["max_lat"]
        and ACT_BOUNDS["min_lon"] <= point.lon <= ACT_BOUNDS["max_lon"]
    )


def point_in_nsw_or_act(point: Point) -> bool:
    if point_in_act(point):
        return True
    if not (
        NSW_BOUNDS["min_lat"] <= point.lat <= NSW_BOUNDS["max_lat"]
        and NSW_BOUNDS["min_lon"] <= point.lon <= NSW_BOUNDS["max_lon"]
    ):
        return False
    return not point_in_qld(point) and not point_in_wa(point) and not point_in_vic(point)


def nsw_vic_border_lat_at_lon(lon: float) -> float | None:
    first = NSW_VIC_BORDER_POINTS[0]
    last = NSW_VIC_BORDER_POINTS[-1]
    if lon < first["lon"] or lon > last["lon"]:
        return None
    for index in range(1, len(NSW_VIC_BORDER_POINTS)):
        left = NSW_VIC_BORDER_POINTS[index - 1]
        right = NSW_VIC_BORDER_POINTS[index]
        if lon < left["lon"] or lon > right["lon"]:
            continue
        span = right["lon"] - left["lon"]
        ratio = (lon - left["lon"]) / span if span else 0
        return left["lat"] + (right["lat"] - left["lat"]) * ratio
    return None


def qld_nsw_border_area(point: Point, radius_km: float = 0.0) -> bool:
    return point_in_qld(point) and point.lat <= -27.75 and point.lon >= 151.0 and radius_km >= 20


def live_provider_keys_for_area(points: list[Point], *, radius_km: float = 0.0) -> list[str]:
    if not points:
        if has_live_credentials():
            return ["nsw"]
        if has_qld_credentials():
            return ["qld"]
        if has_wa_provider():
            return ["wa"]
        if has_vic_credentials():
            return ["vic"]
        return ["nsw"]
    if any(point_in_wa(point) for point in points):
        return ["wa"]
    if any(point_in_vic(point) for point in points):
        providers = ["vic"]
        if any(point_in_nsw_or_act(point) for point in points):
            providers.append("nsw")
        return providers
    has_qld_point = any(point_in_qld(point) for point in points)
    has_non_qld_point = any(not point_in_qld(point) for point in points)
    if has_qld_point:
        providers = ["qld"]
        if has_non_qld_point or any(qld_nsw_border_area(point, radius_km) for point in points):
            providers.append("nsw")
        return providers
    if any(point_in_nsw_or_act(point) for point in points):
        return ["nsw"]
    return []


def load_live_stations_for_area(
    *,
    force_refresh: bool = False,
    points: list[Point] | None = None,
    radius_km: float = 0.0,
) -> tuple[list[dict[str, Any]], str]:
    providers = live_provider_keys_for_area(points or [], radius_km=radius_km)
    stations: list[dict[str, Any]] = []
    loaded_providers: list[str] = []
    errors: list[str] = []
    for provider in providers:
        try:
            if provider == "qld":
                stations.extend(load_live_qld_stations(force_refresh=force_refresh))
                loaded_providers.append("api_qld")
            elif provider == "wa":
                stations.extend(
                    load_live_wa_stations(
                        force_refresh=force_refresh,
                        points=points or [],
                        radius_km=radius_km,
                    )
                )
                loaded_providers.append("api_wa")
            elif provider == "vic":
                stations.extend(load_live_vic_stations(force_refresh=force_refresh))
                loaded_providers.append("api_vic")
            elif provider == "nsw":
                stations.extend(load_live_stations(force_refresh=force_refresh))
                loaded_providers.append("api_nsw")
        except Exception as exc:
            errors.append(f"{provider}: {exc}")

    if not stations:
        raise RuntimeError("; ".join(errors) or "No live fuel providers are configured.")

    by_code: dict[str, dict[str, Any]] = {}
    for station in stations:
        by_code[str(station.get("stationCode"))] = station

    provider_source = "+".join(loaded_providers) if loaded_providers else "live"
    return list(by_code.values()), provider_source


def station_brand_text(station: dict[str, Any]) -> str:
    return f"{station.get('brand') or ''} {station.get('name') or ''}".lower()


def inferred_discounts_for_station(station: dict[str, Any]) -> list[dict[str, Any]]:
    text = station_brand_text(station)
    discounts = []
    for rule in DISCOUNT_RULES:
        if any(needle in text for needle in rule["brandIncludes"]):
            discounts.append(
                {
                    "id": rule["id"],
                    "label": rule["label"],
                    "centsPerLitre": rule["centsPerLitre"],
                    "inferred": True,
                }
            )
    return discounts


def station_with_discount_rules(station: dict[str, Any]) -> dict[str, Any]:
    enriched = dict(station)
    by_id: dict[str, dict[str, Any]] = {}
    for item in station.get("discounts") or []:
        if isinstance(item, dict) and item.get("id"):
            by_id[str(item["id"])] = dict(item)
    for item in inferred_discounts_for_station(station):
        by_id.setdefault(str(item["id"]), item)
    enriched["discounts"] = list(by_id.values())
    return enriched


def fetch_json(
    url: str,
    *,
    data: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> dict[str, Any] | list[Any]:
    body = json.dumps(data).encode("utf-8") if data is not None else None
    request_headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        **(headers or {}),
    }
    if data is not None:
        request_headers["Content-Type"] = "application/json"
    request = Request(url, data=body, headers=request_headers)
    with urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def geocode_item_payload(
    *,
    label: str,
    lat: float,
    lon: float,
    provider: str,
    kind: str = "place",
    provider_id: str = "",
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "label": label,
        "lat": lat,
        "lon": lon,
        "type": kind,
        "provider": provider,
    }
    if provider_id:
        payload["providerId"] = provider_id
    return payload


def nominatim_item_payload(item: dict[str, Any], query: str) -> dict[str, Any]:
    label = str(item.get("display_name") or item.get("name") or query)
    return geocode_item_payload(
        label=label,
        lat=float(item["lat"]),
        lon=float(item["lon"]),
        kind=str(item.get("type") or item.get("class") or "place"),
        provider="nominatim",
        provider_id=f"{item.get('osm_type') or ''}:{item.get('osm_id') or ''}",
    )


def normalise_geocode_provider(value: str) -> str:
    provider = GEOCODE_PROVIDER_ALIASES.get(value.strip().lower())
    if not provider:
        raise ValueError(
            "provider must be auto, google, mapbox, here, geoapify or nominatim"
        )
    return provider


def geocode_provider_configured(provider: str) -> bool:
    if provider == "google":
        return bool(google_places_api_key())
    if provider == "mapbox":
        return bool(mapbox_access_token())
    if provider == "here":
        return bool(here_api_key())
    if provider == "geoapify":
        return bool(geoapify_api_key())
    return provider == "nominatim"


def select_geocode_provider(value: str, *, allow_fallback: bool = False) -> str:
    provider = normalise_geocode_provider(value)
    if provider == "auto":
        for candidate in ["google", "mapbox", "here", "geoapify"]:
            if geocode_provider_configured(candidate):
                return candidate
        return "nominatim"
    if geocode_provider_configured(provider):
        return provider
    if allow_fallback:
        return "nominatim"
    raise ValueError(f"{provider} geocoding is not configured")


def nominatim_geocode(query: str, limit: int) -> list[dict[str, Any]]:
    global NOMINATIM_BLOCKED_UNTIL
    if time.time() < NOMINATIM_BLOCKED_UNTIL:
        raise ValueError("Validation geocoder is cooling down after rate limiting")
    last_error = f"No location found for {query}"
    suggestions: list[dict[str, Any]] = []
    seen: set[str] = set()
    for candidate_query in geocode_query_variants(query):
        search_params = urlencode(
            {
                "q": candidate_query,
                "format": "jsonv2",
                "limit": str(limit),
                "countrycodes": "au",
                "addressdetails": "1",
            }
        )
        try:
            payload = fetch_json(f"https://nominatim.openstreetmap.org/search?{search_params}")
        except Exception as exc:
            if is_rate_limit_error(exc):
                NOMINATIM_BLOCKED_UNTIL = time.time() + NOMINATIM_RATE_LIMIT_BACKOFF_SECONDS
            raise
        if isinstance(payload, list) and payload:
            for item in payload:
                suggestion = nominatim_item_payload(item, candidate_query)
                key = geocode_suggestion_key(suggestion)
                if key in seen:
                    continue
                suggestions.append(suggestion)
                seen.add(key)
                if len(suggestions) >= limit:
                    return suggestions
    if not suggestions:
        raise ValueError(last_error)
    return suggestions


def geocode_query_variants(query: str) -> list[str]:
    cleaned = re.sub(r"\s+", " ", query.strip().strip(".")).strip()
    variants = [cleaned]

    corrected = cleaned
    for typo, replacement in GEOCODE_QUERY_CORRECTIONS.items():
        corrected = re.sub(rf"\b{re.escape(typo)}\b", replacement, corrected, flags=re.IGNORECASE)
    if corrected != cleaned:
        variants.append(corrected)

    for value in list(variants):
        match = STREET_QUERY_PATTERN.match(value)
        if not match:
            continue
        street_only = match.group(1).strip()
        variants.extend([street_only, f"{street_only} Sydney", f"{street_only} NSW"])

    if PARTIAL_STREET_QUERY_PATTERN.match(cleaned) and not STREET_QUERY_PATTERN.match(cleaned):
        for street_type in STREET_TYPE_EXPANSIONS:
            variants.extend([f"{cleaned} {street_type} NSW", f"{cleaned} {street_type} Sydney NSW"])

    variants.extend([f"{cleaned} NSW", f"{cleaned} Australia"])

    unique = []
    seen = set()
    for value in variants:
        key = value.lower()
        if value and key not in seen:
            unique.append(value)
            seen.add(key)
    return unique[:8]


def local_station_geocode(query: str, limit: int) -> list[dict[str, Any]]:
    needle = normalise_search_text(query)
    if len(needle) < 3:
        return []
    try:
        stations, _source = load_live_stations_for_area(points=[], radius_km=0)
    except Exception:
        return []

    scored: list[tuple[int, int, dict[str, Any]]] = []
    for station in stations:
        haystack = normalise_search_text(
            " ".join(
                str(value)
                for value in [
                    station.get("name"),
                    station.get("brand"),
                    station.get("suburb"),
                    station.get("address"),
                ]
                if value
            )
        )
        if needle not in haystack:
            continue
        name = str(station.get("name") or station.get("brand") or "Fuel station")
        suburb = f", {station.get('suburb')}" if station.get("suburb") else ""
        address = f" - {station.get('address')}" if station.get("address") else ""
        item = geocode_item_payload(
            label=f"{name}{suburb}{address}",
            lat=float(station["lat"]),
            lon=float(station["lon"]),
            kind="fuel_station",
            provider="fuel_path",
            provider_id=str(station.get("stationCode") or ""),
        )
        scored.append((0 if haystack.startswith(needle) else haystack.find(needle), len(item["label"]), item))
    scored.sort(key=lambda row: (row[0], row[1]))
    return [row[2] for row in scored[:limit]]


def local_address_geocode(query: str, limit: int) -> list[dict[str, Any]]:
    needle = normalise_address_text(query)
    if len(needle) < 4:
        return []
    sqlite_results = search_gnaf_sqlite(needle, limit)
    if sqlite_results:
        return sqlite_results
    scored: list[tuple[int, int, dict[str, Any], str]] = []
    for record in load_gnaf_seed_records():
        result = score_address_record(record, needle)
        if not result:
            continue
        score, match_type = result
        item = geocode_item_payload(
            label=str(record["label"]),
            lat=float(record["lat"]),
            lon=float(record["lon"]),
            kind="address",
            provider="fuel_path_gnaf",
            provider_id=str(record.get("id") or record["label"]),
        )
        item["confidence"] = "high" if match_type == "exact_address" else "medium"
        item["matchType"] = match_type
        item["score"] = score
        item["source"] = "gnaf_address_index"
        item["accuracy"] = str(record.get("accuracy") or "address_index")
        item["state"] = str(record.get("state") or "")
        item["postcode"] = str(record.get("postcode") or "")
        scored.append((score, -len(str(record["label"])), item, match_type))
    scored.sort(key=lambda row: (row[0], row[1]), reverse=True)
    return [row[2] for row in scored[:limit]]


def search_gnaf_sqlite(needle: str, limit: int) -> list[dict[str, Any]]:
    sqlite_path = os.getenv("FUEL_PATH_GNAF_SQLITE_PATH", "").strip()
    if not sqlite_path or not Path(sqlite_path).exists():
        return []
    try:
        with sqlite3.connect(sqlite_path) as connection:
            connection.row_factory = sqlite3.Row
            terms = [re.sub(r"[^a-z0-9_-]+", " ", term).strip() for term in needle.split()[:8]]
            fts_query = " ".join(f"{term}*" for term in terms if term)
            if fts_query:
                try:
                    rows = connection.execute(
                        """
                        SELECT id, label, lat, lon, state, postcode, accuracy, search_text
                        FROM address_fts
                        WHERE address_fts MATCH ?
                        ORDER BY rank
                        LIMIT ?
                        """,
                        (fts_query, limit),
                    ).fetchall()
                    if rows:
                        return [sqlite_address_row_to_suggestion(row, needle) for row in rows]
                except sqlite3.Error:
                    pass
            rows = connection.execute(
                """
                SELECT id, label, lat, lon, state, postcode, accuracy, search_text
                FROM addresses
                WHERE search_text LIKE ?
                ORDER BY LENGTH(label)
                LIMIT ?
                """,
                (f"%{needle}%", limit),
            ).fetchall()
            return [sqlite_address_row_to_suggestion(row, needle) for row in rows]
    except sqlite3.Error:
        return []


def sqlite_address_row_to_suggestion(row: sqlite3.Row, needle: str) -> dict[str, Any]:
    text = normalise_address_text(str(row["search_text"] or row["label"]))
    if text == needle:
        match_type = "exact_address"
    elif text.startswith(needle):
        match_type = "address_prefix"
    else:
        match_type = "address_contains"
    item = geocode_item_payload(
        label=str(row["label"]),
        lat=float(row["lat"]),
        lon=float(row["lon"]),
        kind="address",
        provider="fuel_path_gnaf",
        provider_id=str(row["id"]),
    )
    item["confidence"] = "high" if match_type == "exact_address" else "medium"
    item["matchType"] = match_type
    item["source"] = "gnaf_address_index"
    item["accuracy"] = str(row["accuracy"] or "address_index")
    item["state"] = str(row["state"] or "")
    item["postcode"] = str(row["postcode"] or "")
    return item


def score_address_record(record: dict[str, Any], needle: str) -> tuple[int, str] | None:
    texts = [normalise_address_text(str(record.get("label") or ""))]
    texts.extend(normalise_address_text(str(alias)) for alias in record.get("aliases") or [])
    best_score = 0
    match_type = ""
    for text in texts:
        if needle == text:
            best_score = max(best_score, 1000)
            match_type = "exact_address"
        elif text.startswith(needle):
            best_score = max(best_score, 900)
            match_type = match_type or "address_prefix"
        elif needle in text:
            best_score = max(best_score, 760)
            match_type = match_type or "address_contains"
        elif len(text) >= 8 and text in needle:
            best_score = max(best_score, 680)
            match_type = match_type or "address_alias"
    return (best_score, match_type) if best_score else None


def has_exact_address_suggestion(suggestions: list[dict[str, Any]]) -> bool:
    return any(
        item.get("provider") == "fuel_path_gnaf" and item.get("matchType") == "exact_address"
        for item in suggestions
    )


def load_gnaf_seed_records() -> list[dict[str, Any]]:
    global GNAF_SEED_RECORDS
    if GNAF_SEED_RECORDS is not None:
        return GNAF_SEED_RECORDS
    try:
        payload = json.loads(GNAF_SEED_PATH.read_text())
        GNAF_SEED_RECORDS = payload if isinstance(payload, list) else []
    except Exception:
        GNAF_SEED_RECORDS = []
    return GNAF_SEED_RECORDS


def address_index_status() -> dict[str, Any]:
    sqlite_path = os.getenv("FUEL_PATH_GNAF_SQLITE_PATH", "").strip()
    sqlite_configured = bool(sqlite_path and Path(sqlite_path).exists())
    seed_records = len(load_gnaf_seed_records())
    return {
        "configured": sqlite_configured or seed_records > 0,
        "mode": "sqlite" if sqlite_configured else ("seed" if seed_records else "disabled"),
        "sqliteConfigured": sqlite_configured,
        "seedRecords": seed_records,
        "source": sqlite_path if sqlite_configured else str(GNAF_SEED_PATH),
        "provider": "fuel_path_gnaf",
    }


def local_hint_geocode(query: str, limit: int) -> list[dict[str, Any]]:
    needle = normalise_search_text(query)
    if len(needle) < 3:
        return []
    scored: list[tuple[int, int, dict[str, Any]]] = []
    for hint in LOCAL_GEOCODE_HINTS:
        texts = [normalise_search_text(str(hint["label"]))]
        texts.extend(normalise_search_text(str(alias)) for alias in hint.get("aliases", []))
        if not any(local_hint_matches(needle, value, str(hint.get("kind") or "")) for value in texts):
            continue
        indexes = [value.find(needle) for value in texts if value.find(needle) >= 0]
        score = min(indexes) if indexes else 999
        item = geocode_item_payload(
            label=str(hint["label"]),
            lat=float(hint["lat"]),
            lon=float(hint["lon"]),
            kind=str(hint.get("kind") or "place"),
            provider="fuel_path_hint",
            provider_id=normalise_search_text(str(hint["label"])),
        )
        scored.append((score, len(item["label"]), item))
    scored.sort(key=lambda row: (row[0], row[1]))
    return [row[2] for row in scored[:limit]]


def local_hint_matches(needle: str, value: str, kind: str) -> bool:
    if not value:
        return False
    if needle == value or needle in value:
        return True
    if kind == "city":
        return False
    return len(value) >= 6 and value in needle


def normalise_search_text(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(value).lower())).strip()


def normalise_address_text(value: str) -> str:
    expanded = str(value).lower()
    replacements = {
        r"\bst\b": "street",
        r"\brd\b": "road",
        r"\bave\b": "avenue",
        r"\bdr\b": "drive",
        r"\bpde\b": "parade",
        r"\bpl\b": "place",
        r"\bln\b": "lane",
    }
    for pattern, replacement in replacements.items():
        expanded = re.sub(pattern, replacement, expanded)
    return normalise_search_text(expanded)


def geocode_suggestion_key(item: dict[str, Any]) -> str:
    return (
        f"{round(float(item.get('lat', 0)) * 100000)}:"
        f"{round(float(item.get('lon', 0)) * 100000)}:"
        f"{normalise_search_text(str(item.get('label', '')))[:48]}"
    )


def google_place_details(
    *,
    place_id: str,
    session_token: str,
) -> dict[str, Any] | None:
    params = urlencode({"sessionToken": session_token}) if session_token else ""
    url = f"https://places.googleapis.com/v1/places/{quote(place_id, safe='')}"
    if params:
        url = f"{url}?{params}"
    payload = fetch_json(
        url,
        headers={
            "X-Goog-Api-Key": google_places_api_key(),
            "X-Goog-FieldMask": "id,displayName,formattedAddress,location,types",
        },
    )
    if not isinstance(payload, dict):
        return None
    location = payload.get("location") or {}
    if "latitude" not in location or "longitude" not in location:
        return None
    label = (
        payload.get("formattedAddress")
        or (payload.get("displayName") or {}).get("text")
        or place_id
    )
    return {
        "label": str(label),
        "lat": float(location["latitude"]),
        "lon": float(location["longitude"]),
        "type": ",".join(payload.get("types") or []) or "place",
        "provider": "google",
        "providerId": str(payload.get("id") or place_id),
    }


def google_geocode(query: str, limit: int, session_token: str) -> list[dict[str, Any]]:
    payload = fetch_json(
        "https://places.googleapis.com/v1/places:autocomplete",
        data={
            "input": query,
            "sessionToken": session_token,
            "includedRegionCodes": ["au"],
            "languageCode": "en-AU",
        },
        headers={
            "X-Goog-Api-Key": google_places_api_key(),
            "X-Goog-FieldMask": (
                "suggestions.placePrediction.placeId,"
                "suggestions.placePrediction.text,"
                "suggestions.placePrediction.types"
            ),
        },
    )
    if not isinstance(payload, dict):
        raise ValueError(f"No location found for {query}")
    suggestions = []
    for item in payload.get("suggestions") or []:
        prediction = item.get("placePrediction") or {}
        place_id = prediction.get("placeId")
        if not place_id:
            continue
        details = google_place_details(place_id=str(place_id), session_token=session_token)
        if details:
            suggestions.append(details)
        if len(suggestions) >= limit:
            break
    if not suggestions:
        raise ValueError(f"No location found for {query}")
    return suggestions


def mapbox_geocode(query: str, limit: int) -> list[dict[str, Any]]:
    params = urlencode(
        {
            "q": query,
            "country": "au",
            "limit": str(limit),
            "autocomplete": "true",
            "access_token": mapbox_access_token(),
        }
    )
    payload = fetch_json(f"https://api.mapbox.com/search/geocode/v6/forward?{params}")
    if not isinstance(payload, dict):
        raise ValueError(f"No location found for {query}")
    suggestions = []
    for feature in payload.get("features") or []:
        coordinates = (feature.get("geometry") or {}).get("coordinates") or []
        if len(coordinates) < 2:
            continue
        properties = feature.get("properties") or {}
        label = (
            properties.get("full_address")
            or properties.get("name_preferred")
            or properties.get("name")
            or feature.get("place_name")
            or query
        )
        suggestions.append(
            geocode_item_payload(
                label=str(label),
                lat=float(coordinates[1]),
                lon=float(coordinates[0]),
                kind=str(properties.get("feature_type") or "place"),
                provider="mapbox",
                provider_id=str(properties.get("mapbox_id") or feature.get("id") or ""),
            )
        )
    if not suggestions:
        raise ValueError(f"No location found for {query}")
    return suggestions


def here_geocode(query: str, limit: int) -> list[dict[str, Any]]:
    params = urlencode(
        {
            "q": query,
            "at": "-33.8688,151.2093",
            "in": "countryCode:AUS",
            "limit": str(limit),
            "apiKey": here_api_key(),
        }
    )
    payload = fetch_json(f"https://autosuggest.search.hereapi.com/v1/autosuggest?{params}")
    if not isinstance(payload, dict):
        raise ValueError(f"No location found for {query}")
    suggestions = []
    for item in payload.get("items") or []:
        position = item.get("position") or {}
        if "lat" not in position or "lng" not in position:
            continue
        label = item.get("title") or (item.get("address") or {}).get("label") or query
        suggestions.append(
            geocode_item_payload(
                label=str(label),
                lat=float(position["lat"]),
                lon=float(position["lng"]),
                kind=str(item.get("resultType") or "place"),
                provider="here",
                provider_id=str(item.get("id") or ""),
            )
        )
    if not suggestions:
        raise ValueError(f"No location found for {query}")
    return suggestions


def geoapify_geocode(query: str, limit: int) -> list[dict[str, Any]]:
    params = urlencode(
        {
            "text": query,
            "filter": "countrycode:au",
            "limit": str(limit),
            "apiKey": geoapify_api_key(),
        }
    )
    payload = fetch_json(f"https://api.geoapify.com/v1/geocode/autocomplete?{params}")
    items = []
    if isinstance(payload, dict):
        items = payload.get("features") or payload.get("results") or []
    if not isinstance(items, list):
        raise ValueError(f"No location found for {query}")
    suggestions = []
    for item in items:
        properties = item.get("properties") if isinstance(item, dict) else {}
        properties = properties or item
        geometry = item.get("geometry") if isinstance(item, dict) else {}
        coordinates = (geometry or {}).get("coordinates") or []
        lat = properties.get("lat")
        lon = properties.get("lon")
        if lat is None and len(coordinates) >= 2:
            lon = coordinates[0]
            lat = coordinates[1]
        if lat is None or lon is None:
            continue
        label = properties.get("formatted") or properties.get("address_line1") or query
        suggestions.append(
            geocode_item_payload(
                label=str(label),
                lat=float(lat),
                lon=float(lon),
                kind=str(properties.get("result_type") or "place"),
                provider="geoapify",
                provider_id=str(properties.get("place_id") or ""),
            )
        )
    if not suggestions:
        raise ValueError(f"No location found for {query}")
    return suggestions


def provider_geocode(
    *,
    provider: str,
    query: str,
    limit: int,
    session_token: str,
) -> list[dict[str, Any]]:
    if provider == "google":
        return google_geocode(query, limit, session_token)
    if provider == "mapbox":
        return mapbox_geocode(query, limit)
    if provider == "here":
        return here_geocode(query, limit)
    if provider == "geoapify":
        return geoapify_geocode(query, limit)
    return nominatim_geocode(query, limit)


def build_geocode_response(params: dict[str, list[str]]) -> dict[str, Any]:
    query = get_param(params, "q", "").strip()
    if not query:
        raise ValueError("q is required")
    limit = max(1, min(8, int_param(params, "limit", 1)))
    session_token = get_param(params, "sessionToken", "").strip()
    requested_provider = get_param(
        params,
        "provider",
        os.getenv("FUEL_PATH_GEOCODE_PROVIDER", "nominatim"),
    )
    provider = select_geocode_provider(requested_provider)
    cache_key = geocode_cache_key(provider, query, limit)
    cached = read_geocode_cache(cache_key)
    if cached:
        return {**cached, "cache": "hit", "sessionToken": session_token}
    local_suggestions = merge_geocode_suggestions(
        [
            *local_address_geocode(query, limit),
            *local_hint_geocode(query, limit),
            *(
                local_station_geocode(query, limit)
                if provider == "nominatim" and looks_like_station_query(query)
                else []
            ),
        ],
        limit,
    )
    provider_warning = ""
    provider_suggestions = []
    if not has_exact_address_suggestion(local_suggestions):
        try:
            provider_suggestions = provider_geocode(
                provider=provider,
                query=query,
                limit=limit,
                session_token=session_token,
            )
        except Exception as exc:
            provider_suggestions = []
            provider_warning = geocode_provider_warning(exc, provider)
    suggestions = merge_geocode_suggestions([*local_suggestions, *provider_suggestions], limit)
    if suggestions:
        lookup_status = "local_fallback" if provider_warning else "ok"
    else:
        lookup_status = "degraded" if provider_warning else "no_match"
    payload = {
        "provider": provider,
        "providerMode": "validation" if provider == "nominatim" else "production_candidate",
        "recommendedProductionProvider": RECOMMENDED_GEOCODE_PROVIDER,
        "requestedProvider": requested_provider,
        "sessionToken": session_token,
        "query": query,
        "location": suggestions[0] if suggestions else None,
        "suggestions": suggestions,
        "lookupStatus": lookup_status,
    }
    if provider_warning:
        payload["warning"] = provider_warning
    write_geocode_cache(cache_key, payload, lookup_status in {"ok", "local_fallback"})
    return payload


def geocode_cache_key(provider: str, query: str, limit: int) -> str:
    return f"{provider}:{limit}:{normalise_search_text(query)}"


def read_geocode_cache(key: str) -> dict[str, Any] | None:
    entry = GEOCODE_CACHE.get(key)
    if not entry:
        return None
    if time.time() > float(entry["expires_at"]):
        GEOCODE_CACHE.pop(key, None)
        return None
    return dict(entry["payload"])


def write_geocode_cache(key: str, payload: dict[str, Any], durable: bool) -> None:
    ttl = GEOCODE_CACHE_SECONDS if durable else GEOCODE_DEGRADED_CACHE_SECONDS
    GEOCODE_CACHE[key] = {"expires_at": time.time() + ttl, "payload": dict(payload)}


def is_rate_limit_error(error: Exception) -> bool:
    return "429" in str(error)


def geocode_provider_warning(error: Exception, provider: str) -> str:
    message = str(error)
    if is_rate_limit_error(error) or re.search(
        r"cooling down|rate limit", message, flags=re.IGNORECASE
    ):
        return (
            "Address lookup is temporarily busy. Try a fuller address, suburb or postcode."
        )
    if re.search(r"abort|timeout|timed out", message, flags=re.IGNORECASE):
        return "Address lookup took too long. Try a fuller address, suburb or postcode."
    if re.search(r"No location found", message, flags=re.IGNORECASE):
        return "No strong location match found. Try a fuller address, suburb or postcode."
    return "Address lookup is temporarily unavailable. Try a fuller address, suburb or postcode."


def public_api_error(exc: Exception, surface: str) -> str:
    message = str(exc)
    if surface == "geocode":
        if re.search(r"No location found|q is required", message, flags=re.IGNORECASE):
            return "No strong location match found. Try a fuller address, suburb or postcode."
        return "Address lookup is temporarily unavailable. Try a fuller address, suburb or postcode."
    if surface == "route":
        return "Route planning is temporarily unavailable. Check the addresses or choose a saved route."
    if surface == "score":
        return "Fuel stop recommendations are temporarily unavailable. Try again or use sample mode."
    if surface == "stations":
        return "Nearby prices are temporarily unavailable. Try again or search another area."
    return "Fuel Path could not finish that request. Try again shortly."


def looks_like_station_query(query: str) -> bool:
    needle = normalise_search_text(query)
    if len(needle) < 3:
        return False
    for term in STATION_QUERY_TERMS:
        normalised_term = normalise_search_text(term)
        if needle == normalised_term or normalised_term in needle:
            return True
    return False


def merge_geocode_suggestions(items: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in items:
        key = geocode_suggestion_key(item)
        if key in seen:
            continue
        merged.append(item)
        seen.add(key)
        if len(merged) >= limit:
            break
    return merged


def build_route_response(params: dict[str, list[str]]) -> dict[str, Any]:
    from_lat = float_param(params, "fromLat", 0)
    from_lon = float_param(params, "fromLon", 0)
    to_lat = float_param(params, "toLat", 0)
    to_lon = float_param(params, "toLon", 0)
    from_label = get_param(params, "fromLabel", "Start")
    to_label = get_param(params, "toLabel", "Destination")
    if not all([from_lat, from_lon, to_lat, to_lon]):
        raise ValueError("fromLat, fromLon, toLat and toLon are required")

    coords = f"{from_lon},{from_lat};{to_lon},{to_lat}"
    route_params = urlencode({"overview": "full", "geometries": "geojson"})
    payload = fetch_json(f"http://router.project-osrm.org/route/v1/driving/{quote(coords, safe=';,')}?{route_params}")
    if not isinstance(payload, dict) or payload.get("code") != "Ok" or not payload.get("routes"):
        raise ValueError(payload.get("message") if isinstance(payload, dict) else "Route not found")
    route = payload["routes"][0]
    coordinates = route.get("geometry", {}).get("coordinates") or []
    if len(coordinates) < 2:
        raise ValueError("Route returned no geometry")
    points = [{"lat": float(lat), "lon": float(lon)} for lon, lat in coordinates]
    points[0]["label"] = from_label
    points[-1]["label"] = to_label
    return {
        "provider": "osrm",
        "distanceKm": round(float(route.get("distance", 0)) / 1000, 2),
        "durationMin": round(float(route.get("duration", 0)) / 60, 1),
        "points": points,
    }


def candidate_payload(candidate: Candidate) -> dict[str, Any]:
    station = candidate.station
    discount_labels = []
    for warning in candidate.warnings:
        if warning.startswith("discount applied:"):
            discount_labels = [
                item.strip()
                for item in warning.replace("discount applied:", "").split(",")
                if item.strip()
            ]
    return {
        "station": {
            "stationCode": station.get("stationCode"),
            "name": station.get("name"),
            "brand": station.get("brand"),
            "suburb": station.get("suburb"),
            "address": station.get("address"),
            "phone": station.get("phone"),
            "lat": station.get("lat"),
            "lon": station.get("lon"),
            "openNow": station.get("openNow", True),
            "membershipRequired": station.get("membershipRequired", False),
            "updatedAt": station.get("updatedAt"),
            "source": station.get("source"),
            "prices": station.get("prices", {}),
            "discounts": station.get("discounts", []),
        },
        "fuel": candidate.fuel,
        "pumpCpl": round(candidate.pump_cpl, 1),
        "adjustedCpl": round(candidate.adjusted_cpl, 1),
        "discountCpl": round(candidate.discount_cpl, 1),
        "discountLabels": discount_labels,
        "detourKm": round(candidate.detour_km, 2),
        "detourMinutes": round(candidate.detour_minutes, 1),
        "detourCost": round(candidate.detour_cost_dollars, 2),
        "fillLitres": round(candidate.fill_litres, 1),
        "netSaving": round(candidate.net_saving_dollars, 2),
        "reachable": candidate.reachable,
        "openNow": candidate.open_now,
        "eligible": candidate.eligible,
        "score": round(candidate.score, 2),
        "warnings": candidate.warnings,
        "distanceToRouteKm": round(candidate.distance_to_route_km, 2),
        "distanceAlongRouteKm": round(candidate.distance_along_route_km, 1),
    }


def station_payload(
    station: dict[str, Any],
    *,
    fuel: str,
    distance_km: float | None = None,
) -> dict[str, Any]:
    prices = station.get("prices") or {}
    payload = {
        "stationCode": station.get("stationCode"),
        "name": station.get("name"),
        "brand": station.get("brand") or "Unknown",
        "suburb": station.get("suburb"),
        "address": station.get("address"),
        "phone": station.get("phone"),
        "lat": station.get("lat"),
        "lon": station.get("lon"),
        "openNow": station.get("openNow", True),
        "membershipRequired": station.get("membershipRequired", False),
        "updatedAt": station.get("updatedAt"),
        "source": station.get("source"),
        "prices": prices,
        "discounts": station.get("discounts", []),
    }
    if fuel in prices:
        payload["pumpCpl"] = round(float(prices[fuel]), 1)
    if distance_km is not None:
        payload["distanceKm"] = round(distance_km, 2)
    return payload


def source_from_params(params: dict[str, list[str]]) -> str:
    source = get_param(params, "source", "auto")
    if source == "auto":
        source = "live" if has_any_live_credentials() else "sample"
    if source not in {"live", "sample"}:
        raise ValueError("source must be live, sample or auto")
    return source


def load_stations_for_source(
    source: str,
    *,
    force_refresh: bool = False,
    points: list[Point] | None = None,
    radius_km: float = 0.0,
) -> tuple[list[dict[str, Any]], str]:
    if source == "live":
        stations, provider_source = load_live_stations_for_area(
            force_refresh=force_refresh,
            points=points,
            radius_km=radius_km,
        )
    else:
        stations = load_sample_stations()
        provider_source = "sample"
    return [station_with_discount_rules(station) for station in stations], provider_source


def score_response_for_route(
    *,
    source: str,
    route: dict[str, Any],
    stations: list[dict[str, Any]],
    fuel: str,
    tank_litres: float,
    tank_percent: float,
    economy: float,
    reserve_km: float,
    corridor_km: float,
    eligible_discounts: set[str],
    include_member_prices: bool,
    include_closed: bool,
) -> dict[str, Any]:
    candidates, context = score_candidates_adaptive(
        route=route,
        stations=stations,
        fuel=fuel,
        tank_litres=tank_litres,
        tank_percent=tank_percent,
        economy_l_per_100km=economy,
        reserve_km=reserve_km,
        fill_litres=None,
        corridor_km=corridor_km,
        detour_factor=1.35,
        detour_speed_kmh=None,
        eligible_discounts=eligible_discounts,
        include_member_prices=include_member_prices,
        include_closed=include_closed,
        baseline_cpl=None,
        now=None if source != "sample" else SAMPLE_NOW,
    )
    context["source"] = source
    context["routeProvider"] = route.get("provider") or route.get("routeType") or "sample"
    context["routeCacheHit"] = bool(route.get("cacheHit"))
    context["generatedAt"] = datetime.now(timezone.utc).isoformat()
    context["cacheSeconds"] = int(
        os.getenv("FUEL_PATH_LIVE_CACHE_SECONDS", str(DEFAULT_CACHE_SECONDS))
    )
    context["timingAdvice"] = route_timing_advice(candidates[0] if candidates else None)
    context_stations = route_context_station_payloads(
        route=route,
        stations=stations,
        fuel=fuel,
        excluded_codes={str(candidate.station.get("stationCode")) for candidate in candidates},
        corridor_km=float(context.get("corridorKm") or corridor_km),
        include_member_prices=include_member_prices,
        include_closed=include_closed,
    )
    return {
        "context": context,
        "recommendations": [candidate_payload(candidate) for candidate in candidates[:20]],
        "contextStations": context_stations,
    }


def route_timing_advice(candidate: Candidate | None) -> dict[str, Any]:
    if candidate is None:
        return {
            "action": "no_cycle_signal",
            "visible": False,
            "label": "",
            "reason": "",
        }

    saving = float(candidate.net_saving_dollars or 0)
    detour_minutes = float(candidate.detour_minutes or 0)
    station_name = str(candidate.station.get("name") or "This stop")
    if saving >= 4 and detour_minutes <= 3:
        return {
            "action": "fill_today_on_route",
            "visible": True,
            "label": "Fill today on this route",
            "reason": f"{station_name} is good value with only {detour_minutes:.1f} min detour.",
        }
    if saving >= 1:
        return {
            "action": "fill_today_with_detour",
            "visible": True,
            "label": "Fill today, but check the detour",
            "reason": f"{station_name} saves about {format_money(saving)} after {detour_minutes:.1f} min detour.",
        }
    return {
        "action": "no_cycle_signal",
        "visible": False,
        "label": "",
        "reason": "",
    }


def format_money(value: float) -> str:
    sign = "-" if value < 0 else ""
    return f"{sign}${abs(value):.2f}"


def route_context_station_payloads(
    *,
    route: dict[str, Any],
    stations: list[dict[str, Any]],
    fuel: str,
    excluded_codes: set[str],
    corridor_km: float,
    include_member_prices: bool,
    include_closed: bool,
    limit: int = 40,
) -> list[dict[str, Any]]:
    points = route_points(route)
    context_corridor_km = min(24.0, max(8.0, corridor_km + 4.0, corridor_km * 1.8))
    context: list[tuple[float, float, float, dict[str, Any]]] = []

    for station in stations:
        station_code = str(station.get("stationCode"))
        prices = station.get("prices") or {}
        if station_code in excluded_codes or fuel not in prices:
            continue
        if not include_closed and station.get("openNow", True) is False:
            continue
        if not include_member_prices and station.get("membershipRequired", False):
            continue
        try:
            point = Point(lat=float(station["lat"]), lon=float(station["lon"]))
        except (KeyError, TypeError, ValueError):
            continue
        distance_to_route, distance_along = nearest_route_position(point, points)
        if distance_to_route > context_corridor_km:
            continue
        pump_cpl = float(prices[fuel])
        payload = station_payload(station, fuel=fuel)
        payload["distanceToRouteKm"] = round(distance_to_route, 2)
        payload["distanceAlongRouteKm"] = round(distance_along, 1)
        context.append((distance_to_route, distance_along, pump_cpl, payload))

    context.sort(key=lambda item: (item[0], item[2], item[1]))
    return [item[3] for item in context[:limit]]


def build_score_response(params: dict[str, list[str]]) -> dict[str, Any]:
    source = source_from_params(params)
    force_refresh = bool_param(params, "forceRefresh")

    routes = load_routes()
    route_id = get_param(params, "route", "parramatta-to-sydney-cbd")
    route_by_id = {route["id"]: route for route in routes}
    if route_id not in route_by_id:
        raise ValueError(f"Unknown route: {route_id}")

    brand_filter = bool_param(params, "brandFilter")
    brands = set_param(params, "brands")
    route = route_by_id[route_id]
    stations, provider_source = load_stations_for_source(
        source,
        force_refresh=force_refresh,
        points=route_points(route),
    )
    if brand_filter:
        stations = [station for station in stations if str(station.get("brand") or "Unknown") in brands]
    return score_response_for_route(
        source=provider_source,
        route=route,
        stations=stations,
        fuel=get_param(params, "fuel", "U91").upper(),
        tank_litres=float_param(params, "tankLitres", 55),
        tank_percent=float_param(params, "tankPercent", 45),
        economy=float_param(params, "economy", 8.2),
        reserve_km=float_param(params, "reserveKm", 35),
        corridor_km=float_param(params, "corridorKm", 2.5),
        eligible_discounts=set_param(params, "eligibleDiscounts"),
        include_member_prices=bool_param(params, "includeMemberPrices"),
        include_closed=bool_param(params, "includeClosed"),
    )


def build_score_response_from_json(payload: dict[str, Any]) -> dict[str, Any]:
    source = str(payload.get("source") or "auto")
    if source == "auto":
        source = "live" if has_live_credentials() else "sample"
    if source not in {"live", "sample"}:
        raise ValueError("source must be live, sample or auto")

    force_refresh = bool(payload.get("forceRefresh"))
    route = route_from_payload(payload.get("route") or {})
    stations, provider_source = load_stations_for_source(
        source,
        force_refresh=force_refresh,
        points=route_points(route),
    )
    brands = {str(item) for item in payload.get("brands") or [] if str(item)}
    if bool(payload.get("brandFilter")):
        stations = [station for station in stations if str(station.get("brand") or "Unknown") in brands]
    return score_response_for_route(
        source=provider_source,
        route=route,
        stations=stations,
        fuel=str(payload.get("fuel") or "U91").upper(),
        tank_litres=float(payload.get("tankLitres") or 55),
        tank_percent=float(payload.get("tankPercent") or 45),
        economy=float(payload.get("economy") or 8.2),
        reserve_km=float(payload.get("reserveKm") or 35),
        corridor_km=float(payload.get("corridorKm") or 2.5),
        eligible_discounts={str(item) for item in payload.get("eligibleDiscounts") or [] if str(item)},
        include_member_prices=bool(payload.get("includeMemberPrices")),
        include_closed=bool(payload.get("includeClosed")),
    )


def route_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    points = payload.get("points") if isinstance(payload, dict) else None
    if not isinstance(points, list) or len(points) < 2:
        raise ValueError("Route payload needs at least two points.")
    cleaned_points = []
    for point in points:
        if not isinstance(point, dict):
            continue
        try:
            cleaned_points.append(
                {
                    "lat": float(point["lat"]),
                    "lon": float(point["lon"]),
                    "label": str(point.get("label") or ""),
                }
            )
        except (KeyError, TypeError, ValueError):
            continue
    if len(cleaned_points) < 2:
        raise ValueError("Route payload needs at least two valid points.")
    return {
        "id": str(payload.get("id") or "custom-route"),
        "name": str(payload.get("name") or "Custom route"),
        "provider": str(payload.get("provider") or "open"),
        "points": cleaned_points,
        "defaultCorridorKm": float(payload.get("defaultCorridorKm") or 2.5),
        "defaultDetourSpeedKmh": float(payload.get("defaultDetourSpeedKmh") or 45),
    }


def build_stations_response(params: dict[str, list[str]]) -> dict[str, Any]:
    source = source_from_params(params)
    force_refresh = bool_param(params, "forceRefresh")
    fuel = get_param(params, "fuel", "U91").upper()
    centre = Point(
        lat=float_param(params, "lat", -33.8136),
        lon=float_param(params, "lon", 151.0034),
        label=get_param(params, "label", "Map centre"),
    )
    radius_km = float_param(params, "radiusKm", 8.0)
    limit = max(1, min(500, int_param(params, "limit", 160)))
    include_closed = bool_param(params, "includeClosed")
    include_member_prices = bool_param(params, "includeMemberPrices")
    brand_filter = bool_param(params, "brandFilter")
    brands = set_param(params, "brands")

    loaded_stations, provider_source = load_stations_for_source(
        source,
        force_refresh=force_refresh,
        points=[centre],
        radius_km=radius_km,
    )
    stations = []
    for station in loaded_stations:
        prices = station.get("prices") or {}
        if fuel not in prices:
            continue
        if brand_filter and str(station.get("brand") or "Unknown") not in brands:
            continue
        if not include_closed and station.get("openNow", True) is False:
            continue
        if not include_member_prices and station.get("membershipRequired", False):
            continue
        try:
            point = Point(lat=float(station["lat"]), lon=float(station["lon"]))
        except (KeyError, TypeError, ValueError):
            continue
        distance_km = haversine_km(centre, point)
        if distance_km <= radius_km:
            stations.append((distance_km, station))

    stations.sort(key=lambda item: (float(item[1].get("prices", {}).get(fuel, 9999)), item[0]))
    selected = stations[:limit]
    return {
        "context": {
            "source": provider_source,
            "fuel": fuel,
            "radiusKm": radius_km,
            "centre": {"lat": centre.lat, "lon": centre.lon, "label": centre.label},
            "stationCount": len(stations),
            "returnedCount": len(selected),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "cacheSeconds": int(
                os.getenv("FUEL_PATH_LIVE_CACHE_SECONDS", str(DEFAULT_CACHE_SECONDS))
            ),
        },
        "stations": [
            station_payload(station, fuel=fuel, distance_km=distance_km)
            for distance_km, station in selected
        ],
    }


class FuelPathHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self.send_response(HTTPStatus.FOUND)
            self.send_header("Location", "/web-demo/")
            self.end_headers()
            return

        if parsed.path == "/api/status":
            google_maps_key = google_maps_api_key()
            self.send_json(
                {
                    "api": "fuel-path-local",
                    "credentialsConfigured": has_any_live_credentials(),
                    "defaultSource": "live" if has_any_live_credentials() else "sample",
                    "fuelProviders": {
                        "apiNswConfigured": has_live_credentials(),
                        "apiQldConfigured": has_qld_credentials(),
                        "apiWaConfigured": has_wa_provider(),
                        "apiVicConfigured": has_vic_credentials(),
                        "vicStatus": (
                            "configured_pending_adapter_schema"
                            if has_vic_credentials()
                            else "needs_servo_saver_api_access"
                        ),
                        "selection": "region-aware",
                    },
                    "maps": {
                        "provider": "google" if google_maps_key else "osm",
                        "googleMapsConfigured": bool(google_maps_key),
                        "googleDirectionsEnabled": os.getenv(
                            "FUEL_PATH_GOOGLE_DIRECTIONS_ENABLED", ""
                        ).lower()
                        in {"1", "true", "yes"},
                        "googleMapsApiKey": google_maps_key,
                    },
                    "geocoding": geocode_provider_status(),
                    "cacheSeconds": int(
                        os.getenv("FUEL_PATH_LIVE_CACHE_SECONDS", str(DEFAULT_CACHE_SECONDS))
                    ),
                }
            )
            return

        if parsed.path == "/api/score":
            try:
                self.send_json(build_score_response(parse_qs(parsed.query)))
            except Exception as exc:
                self.send_json({"error": public_api_error(exc, "score")}, status=HTTPStatus.BAD_GATEWAY)
            return

        if parsed.path == "/api/stations":
            try:
                self.send_json(build_stations_response(parse_qs(parsed.query)))
            except Exception as exc:
                self.send_json({"error": public_api_error(exc, "stations")}, status=HTTPStatus.BAD_GATEWAY)
            return

        if parsed.path == "/api/geocode":
            try:
                self.send_json(build_geocode_response(parse_qs(parsed.query)))
            except Exception as exc:
                self.send_json({"error": public_api_error(exc, "geocode")}, status=HTTPStatus.BAD_GATEWAY)
            return

        if parsed.path == "/api/route":
            try:
                self.send_json(build_route_response(parse_qs(parsed.query)))
            except Exception as exc:
                self.send_json({"error": public_api_error(exc, "route")}, status=HTTPStatus.BAD_GATEWAY)
            return

        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/api/score":
            self.send_json({"error": "Not found"}, status=HTTPStatus.NOT_FOUND)
            return
        try:
            length = int(self.headers.get("Content-Length") or "0")
            if length <= 0:
                raise ValueError("Request body is required.")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("Request body must be a JSON object.")
            self.send_json(build_score_response_from_json(payload))
        except Exception as exc:
            self.send_json({"error": public_api_error(exc, "score")}, status=HTTPStatus.BAD_GATEWAY)

    def send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Fuel Path local web demo.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4174)
    parser.add_argument("--env", type=Path, help="Optional env file, for example prototype/.env")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if args.env:
        load_env_file(args.env)

    server = ThreadingHTTPServer((args.host, args.port), FuelPathHandler)
    print(f"Fuel Path demo server: http://{args.host}:{args.port}/web-demo/")
    print("Live API:", "enabled" if has_live_credentials() else "not configured")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
