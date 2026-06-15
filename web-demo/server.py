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
import sys
import time
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote, urlencode, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "prototype" / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

from score_route import DATA_DIR  # noqa: E402
from score_route import Candidate  # noqa: E402
from score_route import Point  # noqa: E402
from score_route import haversine_km  # noqa: E402
from score_route import load_json  # noqa: E402
from score_route import load_live_nsw_prices  # noqa: E402
from score_route import nearest_route_position  # noqa: E402
from score_route import route_points  # noqa: E402
from score_route import score_candidates_adaptive  # noqa: E402


SAMPLE_NOW = datetime.fromisoformat("2026-06-13T08:00:00+10:00")
DEFAULT_CACHE_SECONDS = 300
HTTP_TIMEOUT_SECONDS = 12
USER_AGENT = "FuelPathDemo/0.1 local validation"
RECOMMENDED_GEOCODE_PROVIDER = "google_places_autocomplete_new"
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
STREET_QUERY_PATTERN = re.compile(
    r"^(.+\b(?:street|st|road|rd|avenue|ave|drive|dr|parade|pde|place|pl|lane|ln|way|crescent|cres)\b)\b.*$",
    re.IGNORECASE,
)
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
    last_error = f"No location found for {query}"
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
        payload = fetch_json(f"https://nominatim.openstreetmap.org/search?{search_params}")
        if isinstance(payload, list) and payload:
            return [nominatim_item_payload(item, candidate_query) for item in payload]
    raise ValueError(last_error)


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

    unique = []
    seen = set()
    for value in variants:
        key = value.lower()
        if value and key not in seen:
            unique.append(value)
            seen.add(key)
    return unique


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
    suggestions = provider_geocode(
        provider=provider,
        query=query,
        limit=limit,
        session_token=session_token,
    )
    item = suggestions[0]
    return {
        "provider": provider,
        "providerMode": "validation" if provider == "nominatim" else "production_candidate",
        "recommendedProductionProvider": RECOMMENDED_GEOCODE_PROVIDER,
        "requestedProvider": requested_provider,
        "sessionToken": session_token,
        "query": query,
        "location": item,
        "suggestions": suggestions,
    }


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
        source = "live" if has_live_credentials() else "sample"
    if source not in {"live", "sample"}:
        raise ValueError("source must be live, sample or auto")
    return source


def load_stations_for_source(source: str, *, force_refresh: bool = False) -> list[dict[str, Any]]:
    stations = (
        load_live_stations(force_refresh=force_refresh)
        if source == "live"
        else load_sample_stations()
    )
    return [station_with_discount_rules(station) for station in stations]


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
        now=None if source == "live" else SAMPLE_NOW,
    )
    context["source"] = "api_nsw" if source == "live" else "sample"
    context["routeProvider"] = route.get("provider") or route.get("routeType") or "sample"
    context["routeCacheHit"] = bool(route.get("cacheHit"))
    context["generatedAt"] = datetime.now(timezone.utc).isoformat()
    context["cacheSeconds"] = int(
        os.getenv("FUEL_PATH_LIVE_CACHE_SECONDS", str(DEFAULT_CACHE_SECONDS))
    )
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
    stations = load_stations_for_source(source, force_refresh=force_refresh)
    if brand_filter:
        stations = [station for station in stations if str(station.get("brand") or "Unknown") in brands]
    return score_response_for_route(
        source=source,
        route=route_by_id[route_id],
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
    stations = load_stations_for_source(source, force_refresh=force_refresh)
    brands = {str(item) for item in payload.get("brands") or [] if str(item)}
    if bool(payload.get("brandFilter")):
        stations = [station for station in stations if str(station.get("brand") or "Unknown") in brands]
    return score_response_for_route(
        source=source,
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

    stations = []
    for station in load_stations_for_source(source, force_refresh=force_refresh):
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
            "source": "api_nsw" if source == "live" else "sample",
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
                    "credentialsConfigured": has_live_credentials(),
                    "defaultSource": "live" if has_live_credentials() else "sample",
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
                self.send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)
            return

        if parsed.path == "/api/stations":
            try:
                self.send_json(build_stations_response(parse_qs(parsed.query)))
            except Exception as exc:
                self.send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)
            return

        if parsed.path == "/api/geocode":
            try:
                self.send_json(build_geocode_response(parse_qs(parsed.query)))
            except Exception as exc:
                self.send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)
            return

        if parsed.path == "/api/route":
            try:
                self.send_json(build_route_response(parse_qs(parsed.query)))
            except Exception as exc:
                self.send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)
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
            self.send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)

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
