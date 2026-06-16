#!/usr/bin/env python3
"""
Fuel Path route-scoring feasibility prototype.

This is not a production routing engine. It proves the first product question:
can we rank fuel stops by net saving, detour and range safety instead of only
showing a map of pump prices?
"""

from __future__ import annotations

import argparse
import base64
import json
import math
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DEFAULT_TOKEN_URL = "https://api.onegov.nsw.gov.au/oauth/client_credential/accesstoken"
DEFAULT_PRICES_URL = "https://api.onegov.nsw.gov.au/FuelPriceCheck/v1/fuel/prices"
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Safari/537.36"
)
SYDNEY_TZ = ZoneInfo("Australia/Sydney")
RECOMMENDATION_MAX_PRICE_AGE_HOURS = 48.0
QLD_FUEL_ID_TO_CODE = {
    2: "U91",
    3: "DL",
    5: "P95",
    8: "P98",
    12: "E10",
    14: "PDL",
}
QLD_UNAVAILABLE_PRICE = 9999


@dataclass(frozen=True)
class Point:
    lat: float
    lon: float
    label: str = ""


@dataclass(frozen=True)
class Candidate:
    station: dict[str, Any]
    fuel: str
    pump_cpl: float
    adjusted_cpl: float
    discount_cpl: float
    distance_to_route_km: float
    distance_along_route_km: float
    detour_km: float
    detour_minutes: float
    detour_cost_dollars: float
    fill_litres: float
    gross_fill_cost_dollars: float
    adjusted_fill_cost_dollars: float
    net_saving_dollars: float
    reachable: bool
    open_now: bool
    eligible: bool
    score: float
    warnings: list[str]


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def haversine_km(a: Point, b: Point) -> float:
    radius_km = 6371.0088
    lat1 = math.radians(a.lat)
    lat2 = math.radians(b.lat)
    dlat = lat2 - lat1
    dlon = math.radians(b.lon - a.lon)
    h = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
    return 2 * radius_km * math.asin(math.sqrt(h))


def to_local_xy_km(point: Point, origin: Point) -> tuple[float, float]:
    km_per_degree_lat = 111.32
    km_per_degree_lon = 111.32 * math.cos(math.radians(origin.lat))
    return (
        (point.lon - origin.lon) * km_per_degree_lon,
        (point.lat - origin.lat) * km_per_degree_lat,
    )


def route_points(route: dict[str, Any]) -> list[Point]:
    return [
        Point(float(item["lat"]), float(item["lon"]), item.get("label", ""))
        for item in route["points"]
    ]


def segment_lengths(points: list[Point]) -> list[float]:
    return [haversine_km(points[i], points[i + 1]) for i in range(len(points) - 1)]


def total_route_km(points: list[Point]) -> float:
    return sum(segment_lengths(points))


def nearest_route_position(station: Point, points: list[Point]) -> tuple[float, float]:
    """Return (perpendicular distance to route, distance along route)."""
    if len(points) < 2:
        return haversine_km(station, points[0]), 0.0

    lengths = segment_lengths(points)
    accumulated = 0.0
    best_distance = float("inf")
    best_along = 0.0

    for index, length_km in enumerate(lengths):
        start = points[index]
        end = points[index + 1]
        sx, sy = to_local_xy_km(station, start)
        ex, ey = to_local_xy_km(end, start)
        seg_len_sq = ex * ex + ey * ey
        if seg_len_sq == 0:
            projected = 0.0
        else:
            projected = max(0.0, min(1.0, (sx * ex + sy * ey) / seg_len_sq))
        px = projected * ex
        py = projected * ey
        distance = math.hypot(sx - px, sy - py)
        along = accumulated + projected * length_km
        if distance < best_distance:
            best_distance = distance
            best_along = along
        accumulated += length_km

    return best_distance, best_along


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def price_age_hours(updated_at: str | None, now: datetime) -> float:
    parsed = parse_datetime(updated_at)
    if parsed is None:
        return float("inf")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return max(0.0, (now - parsed.astimezone(now.tzinfo)).total_seconds() / 3600)


def freshness_penalty(updated_at: str | None, now: datetime) -> tuple[float, str | None]:
    hours = price_age_hours(updated_at, now)
    if not math.isfinite(hours):
        return 1.5, "price timestamp missing or invalid"
    if hours <= 1:
        return 0.0, None
    if hours <= 6:
        return 0.5, f"price is {hours:.1f} hours old"
    if hours <= 24:
        return 1.0, f"price is {hours:.1f} hours old"
    if hours <= RECOMMENDATION_MAX_PRICE_AGE_HOURS:
        return 2.0, f"price is {hours:.1f} hours old"
    return 2.0, f"price is {hours:.1f} hours old"


def eligible_discount_cpl(
    station: dict[str, Any], eligible_discounts: set[str]
) -> tuple[float, list[str]]:
    best_discount = 0.0
    best_labels: list[str] = []
    for item in station.get("discounts", []):
        discount_id = str(item.get("id", ""))
        if discount_id in eligible_discounts:
            cents = float(item.get("centsPerLitre", 0.0))
            if cents > best_discount:
                best_discount = cents
                best_labels = [str(item.get("label", discount_id))]
    return best_discount, best_labels


def median(values: Iterable[float]) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


def score_candidates(
    *,
    route: dict[str, Any],
    stations: list[dict[str, Any]],
    fuel: str,
    tank_litres: float,
    tank_percent: float,
    economy_l_per_100km: float,
    reserve_km: float,
    fill_litres: float | None,
    corridor_km: float | None,
    detour_factor: float,
    detour_speed_kmh: float | None,
    eligible_discounts: set[str],
    include_member_prices: bool,
    include_closed: bool,
    baseline_cpl: float | None,
    now: datetime | None = None,
) -> tuple[list[Candidate], dict[str, Any]]:
    points = route_points(route)
    corridor = corridor_km or float(route.get("defaultCorridorKm", 3.0))
    detour_speed = detour_speed_kmh or float(route.get("defaultDetourSpeedKmh", 45.0))
    now = now or datetime.now(timezone.utc).astimezone()
    requested_fill_litres = fill_litres
    if requested_fill_litres is None:
        requested_fill_litres = max(5.0, tank_litres * (1 - tank_percent / 100))

    in_corridor: list[dict[str, Any]] = []
    station_positions: dict[str, tuple[float, float]] = {}
    for station in stations:
        if fuel not in station.get("prices", {}):
            continue
        station_point = Point(float(station["lat"]), float(station["lon"]))
        distance_to_route, distance_along = nearest_route_position(station_point, points)
        if distance_to_route <= corridor:
            in_corridor.append(station)
            station_positions[str(station.get("stationCode"))] = (
                distance_to_route,
                distance_along,
            )

    available_for_baseline = [
        float(station["prices"][fuel])
        for station in in_corridor
        if station.get("openNow") is not False
        and (include_member_prices or not station.get("membershipRequired", False))
    ]
    route_baseline_cpl = baseline_cpl or median(available_for_baseline)

    current_fuel_litres = tank_litres * (tank_percent / 100)
    range_km = (current_fuel_litres / economy_l_per_100km) * 100

    candidates: list[Candidate] = []
    stale_excluded_count = 0
    for station in in_corridor:
        station_code = str(station.get("stationCode"))
        distance_to_route, distance_along = station_positions[station_code]
        open_now = station.get("openNow") is not False
        membership_required = bool(station.get("membershipRequired", False))
        eligible = include_member_prices or not membership_required
        if not include_closed and not open_now:
            continue
        if not eligible:
            continue

        pump_cpl = float(station["prices"][fuel])
        discount_cpl, discount_labels = eligible_discount_cpl(station, eligible_discounts)
        adjusted_cpl = max(0.0, pump_cpl - discount_cpl)
        detour_km = distance_to_route * 2 * detour_factor
        detour_minutes = (detour_km / detour_speed) * 60 if detour_speed > 0 else 0
        detour_fuel_litres = (detour_km * economy_l_per_100km) / 100
        detour_cost = detour_fuel_litres * (adjusted_cpl / 100)
        gross_fill_cost = requested_fill_litres * (pump_cpl / 100)
        adjusted_fill_cost = requested_fill_litres * (adjusted_cpl / 100)
        saving_before_detour = requested_fill_litres * (
            (route_baseline_cpl - adjusted_cpl) / 100
        )
        net_saving = saving_before_detour - detour_cost
        reach_needed_km = distance_along + distance_to_route + reserve_km
        reachable = range_km >= reach_needed_km
        fresh_penalty, fresh_warning = freshness_penalty(station.get("updatedAt"), now)
        if (
            station.get("source") in {"api_nsw_fuelcheck", "api_qld_fuelprices", "api_wa_fuelwatch"}
            and price_age_hours(station.get("updatedAt"), now)
            > RECOMMENDATION_MAX_PRICE_AGE_HOURS
        ):
            stale_excluded_count += 1
            continue

        warnings: list[str] = []
        if discount_labels:
            warnings.append("discount applied: " + ", ".join(discount_labels))
        if membership_required:
            warnings.append("membership-only price included")
        if not open_now:
            warnings.append("station marked closed")
        if not reachable:
            warnings.append(
                f"range risk: needs {reach_needed_km:.1f} km including reserve"
            )
        if fresh_warning:
            warnings.append(fresh_warning)

        score = net_saving
        score -= detour_minutes * 0.08
        score -= fresh_penalty
        if not open_now:
            score -= 100
        if not reachable:
            score -= 100

        candidates.append(
            Candidate(
                station=station,
                fuel=fuel,
                pump_cpl=pump_cpl,
                adjusted_cpl=adjusted_cpl,
                discount_cpl=discount_cpl,
                distance_to_route_km=distance_to_route,
                distance_along_route_km=distance_along,
                detour_km=detour_km,
                detour_minutes=detour_minutes,
                detour_cost_dollars=detour_cost,
                fill_litres=requested_fill_litres,
                gross_fill_cost_dollars=gross_fill_cost,
                adjusted_fill_cost_dollars=adjusted_fill_cost,
                net_saving_dollars=net_saving,
                reachable=reachable,
                open_now=open_now,
                eligible=eligible,
                score=score,
                warnings=warnings,
            )
        )

    candidates.sort(key=lambda item: item.score, reverse=True)
    context = {
        "routeId": route["id"],
        "routeName": route["name"],
        "fuel": fuel,
        "routeDistanceKm": total_route_km(points),
        "corridorKm": corridor,
        "detourFactor": detour_factor,
        "detourSpeedKmh": detour_speed,
        "baselineCpl": route_baseline_cpl,
        "tankRangeKm": range_km,
        "reserveKm": reserve_km,
        "fillLitres": requested_fill_litres,
        "stationsInCorridor": len(in_corridor),
        "eligibleCandidates": len(candidates),
        "freshnessCutoffHours": RECOMMENDATION_MAX_PRICE_AGE_HOURS,
        "staleExcludedCandidates": stale_excluded_count,
    }
    return candidates, context


def adaptive_corridor_attempts(route_distance_km: float, requested_corridor_km: float) -> list[float]:
    attempts = [requested_corridor_km]
    if route_distance_km >= 150:
        attempts.extend([5.0, 8.0, 12.0, 20.0])
    elif route_distance_km >= 50:
        attempts.extend([4.0, 6.0, 10.0])
    else:
        attempts.extend([3.5, 5.0])

    deduped: list[float] = []
    for value in attempts:
        rounded = round(max(requested_corridor_km, value), 1)
        if rounded not in deduped:
            deduped.append(rounded)
    return deduped


def score_candidates_adaptive(**kwargs: Any) -> tuple[list[Candidate], dict[str, Any]]:
    route = kwargs["route"]
    requested_corridor = kwargs.get("corridor_km") or float(
        route.get("defaultCorridorKm", 3.0)
    )
    route_distance = total_route_km(route_points(route))
    attempts = adaptive_corridor_attempts(route_distance, float(requested_corridor))
    first_context: dict[str, Any] | None = None
    last_result: tuple[list[Candidate], dict[str, Any]] | None = None

    for corridor in attempts:
        current_kwargs = dict(kwargs)
        current_kwargs["corridor_km"] = corridor
        candidates, context = score_candidates(**current_kwargs)
        if first_context is None:
            first_context = dict(context)
        context["requestedCorridorKm"] = round(float(requested_corridor), 1)
        context["corridorExpanded"] = corridor > float(requested_corridor)
        context["corridorAttempts"] = attempts
        if context["corridorExpanded"]:
            context["corridorFallbackReason"] = (
                "Expanded the route search because the first corridor returned no eligible stop."
            )
        last_result = (candidates, context)
        if candidates:
            return candidates, context

    if last_result is None:
        raise RuntimeError("Adaptive scoring did not run.")
    candidates, context = last_result
    if first_context:
        context["initialStationsInCorridor"] = first_context.get("stationsInCorridor", 0)
        context["initialEligibleCandidates"] = first_context.get("eligibleCandidates", 0)
    return candidates, context


def candidate_to_dict(candidate: Candidate) -> dict[str, Any]:
    station = candidate.station
    return {
        "stationCode": station.get("stationCode"),
        "name": station.get("name"),
        "brand": station.get("brand"),
        "suburb": station.get("suburb"),
        "fuel": candidate.fuel,
        "pumpCpl": round(candidate.pump_cpl, 1),
        "adjustedCpl": round(candidate.adjusted_cpl, 1),
        "discountCpl": round(candidate.discount_cpl, 1),
        "detourKm": round(candidate.detour_km, 2),
        "detourMinutes": round(candidate.detour_minutes, 1),
        "detourCostDollars": round(candidate.detour_cost_dollars, 2),
        "netSavingDollars": round(candidate.net_saving_dollars, 2),
        "distanceAlongRouteKm": round(candidate.distance_along_route_km, 1),
        "reachable": candidate.reachable,
        "openNow": candidate.open_now,
        "score": round(candidate.score, 2),
        "updatedAt": station.get("updatedAt"),
        "source": station.get("source"),
        "warnings": candidate.warnings,
    }


def print_table(candidates: list[Candidate], context: dict[str, Any], limit: int) -> None:
    print(f"Route: {context['routeName']} ({context['routeDistanceKm']:.1f} km)")
    print(f"Fuel: {context['fuel']}")
    print(
        "Baseline: "
        f"{context['baselineCpl']:.1f} c/L | Fill: {context['fillLitres']:.1f} L | "
        f"Tank range: {context['tankRangeKm']:.1f} km | Reserve: {context['reserveKm']:.1f} km"
    )
    print(
        f"Corridor: {context['corridorKm']:.1f} km | "
        f"Stations in corridor: {context['stationsInCorridor']} | "
        f"Eligible candidates: {context['eligibleCandidates']}"
    )
    print()
    if not candidates:
        print("No eligible candidates found.")
        return

    best = candidates[0]
    best_station = best.station
    print(
        "Recommendation: "
        f"{best_station.get('name')} in {best_station.get('suburb')} "
        f"at {best.adjusted_cpl:.1f} c/L"
    )
    print(
        f"Why: estimated net saving ${best.net_saving_dollars:.2f} "
        f"after a {best.detour_minutes:.1f} min detour."
    )
    if best.warnings:
        print("Notes: " + "; ".join(best.warnings))
    print()

    headers = [
        "rank",
        "station",
        "suburb",
        "c/L",
        "detour",
        "saving",
        "range",
        "notes",
    ]
    print(
        f"{headers[0]:<4} {headers[1]:<28} {headers[2]:<14} {headers[3]:>7} "
        f"{headers[4]:>10} {headers[5]:>10} {headers[6]:>8} {headers[7]}"
    )
    print("-" * 105)
    for index, candidate in enumerate(candidates[:limit], start=1):
        station = candidate.station
        notes = "; ".join(candidate.warnings[:2])
        if len(notes) > 34:
            notes = notes[:31] + "..."
        range_label = "ok" if candidate.reachable else "risk"
        print(
            f"{index:<4} "
            f"{str(station.get('name', ''))[:28]:<28} "
            f"{str(station.get('suburb', ''))[:14]:<14} "
            f"{candidate.adjusted_cpl:>7.1f} "
            f"{candidate.detour_minutes:>8.1f}m "
            f"${candidate.net_saving_dollars:>8.2f} "
            f"{range_label:>8} "
            f"{notes}"
        )


def with_query(url: str, params: dict[str, str]) -> str:
    parsed = urllib.parse.urlparse(url)
    query = dict(urllib.parse.parse_qsl(parsed.query, keep_blank_values=True))
    query.update(params)
    return urllib.parse.urlunparse(parsed._replace(query=urllib.parse.urlencode(query)))


def get_oauth_token(api_key: str, api_secret: str, token_url: str) -> str:
    credential = base64.b64encode(f"{api_key}:{api_secret}".encode()).decode()
    request = urllib.request.Request(
        with_query(token_url, {"grant_type": "client_credentials"}),
        headers={
            "Authorization": f"Basic {credential}",
            "Accept": "application/json",
            "User-Agent": DEFAULT_USER_AGENT,
        },
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        body = response.read().decode("utf-8")
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"OAuth response was not JSON: {body[:160]}") from exc
    token = payload.get("access_token") or payload.get("accessToken")
    if not token:
        raise RuntimeError(f"OAuth response did not include an access token: {payload}")
    return str(token)


def load_live_nsw_prices(api_key: str, api_secret: str) -> list[dict[str, Any]]:
    token_url = os.getenv("NSW_FUEL_TOKEN_URL", DEFAULT_TOKEN_URL).strip() or DEFAULT_TOKEN_URL
    prices_url = os.getenv("NSW_FUEL_PRICES_URL", DEFAULT_PRICES_URL).strip() or DEFAULT_PRICES_URL
    token = get_oauth_token(api_key, api_secret, token_url)
    request = urllib.request.Request(
        prices_url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json",
            "apikey": api_key,
            "transactionid": "fuel-path-prototype",
            "requesttimestamp": datetime.now(timezone.utc).isoformat(),
            "User-Agent": DEFAULT_USER_AGENT,
        },
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return normalise_nsw_payload(payload)


def normalise_nsw_payload(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Best-effort normaliser for FuelCheck-style payloads.

    The API shape needs to be confirmed with a registered key before production
    work. This keeps the prototype from depending on one exact response layout.
    """
    raw_stations = payload.get("stations") or []
    raw_prices = (
        payload.get("prices")
        or payload.get("fuelPrices")
        or payload.get("FuelPrice")
        or []
    )
    stations: dict[str, dict[str, Any]] = {}

    for row in raw_stations:
        if not isinstance(row, dict):
            continue
        station_code = str(
            row.get("code")
            or row.get("stationcode")
            or row.get("stationCode")
            or row.get("stationid")
            or row.get("stationId")
            or ""
        )
        if not station_code:
            continue
        location = row.get("location") if isinstance(row.get("location"), dict) else {}
        address = str(row.get("address") or "")
        stations[station_code] = {
            "stationCode": station_code,
            "name": row.get("name") or station_code,
            "brand": row.get("brand") or "Unknown",
            "suburb": suburb_from_address(address),
            "address": address,
            "phone": station_phone(row),
            "lat": float(location.get("latitude") or row.get("latitude") or 0),
            "lon": float(location.get("longitude") or row.get("longitude") or 0),
            "openNow": True,
            "membershipRequired": False,
            "updatedAt": None,
            "source": "api_nsw_fuelcheck",
            "prices": {},
            "discounts": [],
        }

    for row in raw_prices:
        if not isinstance(row, dict):
            continue
        station_code = str(
            row.get("stationcode")
            or row.get("stationCode")
            or row.get("serviceStationCode")
            or row.get("ServiceStationCode")
            or row.get("ServiceStationID")
            or row.get("stationid")
            or ""
        )
        if not station_code:
            continue
        station = stations.setdefault(
            station_code,
            {
                "stationCode": station_code,
                "name": row.get("stationname")
                or row.get("stationName")
                or row.get("ServiceStationName")
                or station_code,
                "brand": row.get("brand") or row.get("Brand") or "Unknown",
                "suburb": row.get("suburb") or row.get("Suburb") or "",
                "address": row.get("address") or row.get("Address") or "",
                "phone": station_phone(row),
                "lat": float(row.get("latitude") or row.get("Latitude") or 0),
                "lon": float(row.get("longitude") or row.get("Longitude") or 0),
                "openNow": True,
                "membershipRequired": False,
                "updatedAt": row.get("lastupdated")
                or row.get("lastUpdated")
                or row.get("LastUpdated"),
                "source": "api_nsw_fuelcheck",
                "prices": {},
                "discounts": [],
            },
        )
        station["phone"] = station.get("phone") or station_phone(row)
        fuel_code = str(
            row.get("fueltype") or row.get("fuelType") or row.get("FuelCode") or ""
        ).upper()
        price = row.get("price") or row.get("Price") or row.get("fuelprice")
        if fuel_code and price is not None:
            station["prices"][fuel_code] = float(price)
        updated_at = normalise_nsw_timestamp(
            row.get("lastupdated") or row.get("lastUpdated") or row.get("LastUpdated")
        )
        if updated_at and (
            not station.get("updatedAt") or updated_at > str(station.get("updatedAt"))
        ):
            station["updatedAt"] = updated_at
    return list(stations.values())


def normalise_qld_payload(
    site_payload: dict[str, Any],
    price_payload: dict[str, Any],
    brand_payload: dict[str, Any] | None = None,
    region_payload: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Normalise Fuel Prices QLD Direct API payloads into Fuel Path stations."""

    brands = qld_lookup_by_id(brand_payload, "Brands", "BrandId")
    regions = qld_lookup_by_id(region_payload, "GeographicRegions", "GeoRegionId")
    stations: dict[str, dict[str, Any]] = {}

    for row in site_payload.get("S") or []:
        if not isinstance(row, dict):
            continue
        station_code = str(row.get("S") or "")
        if not station_code:
            continue
        suburb = qld_region_name(row, regions)
        address = qld_address(row, suburb)
        brand_id = str(row.get("B") or "")
        stations[station_code] = {
            "stationCode": f"QLD-{station_code}",
            "name": row.get("N") or station_code,
            "brand": brands.get(brand_id) or "Unknown",
            "suburb": suburb,
            "address": address,
            "phone": None,
            "lat": float(row.get("Lat") or 0),
            "lon": float(row.get("Lng") or 0),
            "openNow": qld_open_now(row),
            "membershipRequired": False,
            "updatedAt": normalise_qld_timestamp(row.get("M")),
            "source": "api_qld_fuelprices",
            "prices": {},
            "discounts": [],
        }

    for row in price_payload.get("SitePrices") or []:
        if not isinstance(row, dict):
            continue
        site_id = str(row.get("SiteId") or "")
        if not site_id:
            continue
        fuel_code = QLD_FUEL_ID_TO_CODE.get(int(row.get("FuelId") or 0))
        price = qld_price_cpl(row.get("Price"))
        if not fuel_code or price is None:
            continue
        station = stations.get(site_id)
        if not station:
            station = {
                "stationCode": f"QLD-{site_id}",
                "name": site_id,
                "brand": "Unknown",
                "suburb": "",
                "address": "",
                "phone": None,
                "lat": 0.0,
                "lon": 0.0,
                "openNow": None,
                "membershipRequired": False,
                "updatedAt": None,
                "source": "api_qld_fuelprices",
                "prices": {},
                "discounts": [],
            }
            stations[site_id] = station
        station["prices"][fuel_code] = price
        updated_at = normalise_qld_timestamp(row.get("TransactionDateUtc"))
        if updated_at and (
            not station.get("updatedAt") or updated_at > str(station.get("updatedAt"))
        ):
            station["updatedAt"] = updated_at

    return [
        station
        for station in stations.values()
        if station.get("prices")
        and math.isfinite(float(station.get("lat") or 0))
        and math.isfinite(float(station.get("lon") or 0))
        and (float(station.get("lat") or 0) or float(station.get("lon") or 0))
    ]


def qld_lookup_by_id(
    payload: dict[str, Any] | None,
    list_key: str,
    id_key: str,
) -> dict[str, str]:
    rows = payload.get(list_key) if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        return {}
    return {
        str(row.get(id_key)): str(row.get("Name"))
        for row in rows
        if isinstance(row, dict) and row.get(id_key) is not None and row.get("Name")
    }


def qld_region_name(row: dict[str, Any], regions: dict[str, str]) -> str:
    for key in ("G1", "G2"):
        value = row.get(key)
        if value is not None and str(value) in regions:
            return regions[str(value)]
    return ""


def qld_address(row: dict[str, Any], suburb: str) -> str:
    parts = [str(row.get("A") or "").strip()]
    if suburb:
        parts.append(suburb)
    postcode = str(row.get("P") or "").strip()
    parts.append(f"QLD {postcode}".strip())
    return ", ".join(part for part in parts if part)


def qld_price_cpl(value: Any) -> float | None:
    try:
        price = float(value)
    except (TypeError, ValueError):
        return None
    if price >= QLD_UNAVAILABLE_PRICE:
        return None
    return price / 10


def normalise_qld_timestamp(value: Any) -> str | None:
    if value is None or value == "":
        return None
    text = str(value).strip().replace(" ", "")
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat()


def qld_open_now(row: dict[str, Any]) -> bool | None:
    weekday = datetime.now(SYDNEY_TZ).strftime("%a").upper()
    prefix_by_day = {
        "MON": "M",
        "TUE": "T",
        "WED": "W",
        "THU": "TH",
        "FRI": "F",
        "SAT": "S",
        "SUN": "SU",
    }
    prefix = prefix_by_day.get(weekday)
    if not prefix:
        return None
    open_text = str(row.get(f"{prefix}O") or "").strip()
    close_text = str(row.get(f"{prefix}C") or "").strip()
    if not open_text or not close_text:
        return None
    open_minutes = qld_time_minutes(open_text)
    close_minutes = qld_time_minutes(close_text)
    if open_minutes is None or close_minutes is None:
        return None
    now_minutes = datetime.now(SYDNEY_TZ).hour * 60 + datetime.now(SYDNEY_TZ).minute
    if close_minutes <= open_minutes:
        return now_minutes >= open_minutes or now_minutes <= close_minutes
    return open_minutes <= now_minutes <= close_minutes


def qld_time_minutes(value: str) -> int | None:
    digits = re.sub(r"\D", "", value)
    if len(digits) < 3:
        return None
    digits = digits.zfill(4)[-4:]
    hour = int(digits[:2])
    minute = int(digits[2:])
    if hour > 24 or minute > 59:
        return None
    if hour == 24:
        hour = 0
    return hour * 60 + minute


def station_phone(row: dict[str, Any]) -> str | None:
    value = (
        row.get("phone")
        or row.get("Phone")
        or row.get("telephone")
        or row.get("Telephone")
        or row.get("contactNumber")
        or row.get("ContactNumber")
        or row.get("phoneNumber")
        or row.get("PhoneNumber")
        or row.get("contact")
        or row.get("Contact")
    )
    phone = str(value or "").strip()
    return phone or None


def suburb_from_address(address: str) -> str:
    if "," not in address:
        return ""
    tail = address.rsplit(",", 1)[-1].strip()
    if " NSW " in tail:
        return tail.split(" NSW ", 1)[0].title()
    return tail.title()


def normalise_nsw_timestamp(value: Any) -> str | None:
    if not value:
        return None
    text = str(value)
    for date_format in ("%d/%m/%Y %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            parsed = datetime.strptime(text, date_format)
            return parsed.replace(tzinfo=SYDNEY_TZ).astimezone(timezone.utc).isoformat()
        except ValueError:
            continue
    return text


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Score fuel stops along a saved route corridor."
    )
    parser.add_argument("--route", default="parramatta-to-sydney-cbd")
    parser.add_argument("--fuel", default="U91")
    parser.add_argument("--tank-litres", type=float, default=55.0)
    parser.add_argument("--tank-percent", type=float, default=45.0)
    parser.add_argument("--economy", type=float, default=8.2, help="L/100km")
    parser.add_argument("--reserve-km", type=float, default=35.0)
    parser.add_argument("--fill-litres", type=float)
    parser.add_argument("--corridor-km", type=float)
    parser.add_argument("--detour-factor", type=float, default=1.35)
    parser.add_argument("--detour-speed-kmh", type=float)
    parser.add_argument("--baseline-cpl", type=float)
    parser.add_argument("--eligible-discounts", default="")
    parser.add_argument("--include-member-prices", action="store_true")
    parser.add_argument("--include-closed", action="store_true")
    parser.add_argument("--limit", type=int, default=8)
    parser.add_argument("--json", action="store_true", dest="as_json")
    parser.add_argument("--live", action="store_true", help="Try API.NSW live fuel data.")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    routes_payload = load_json(DATA_DIR / "routes.json")
    route_by_id = {route["id"]: route for route in routes_payload["routes"]}
    if args.route not in route_by_id:
        print(f"Unknown route: {args.route}", file=sys.stderr)
        print("Available routes:", file=sys.stderr)
        for route_id in sorted(route_by_id):
            print(f"  - {route_id}", file=sys.stderr)
        return 2
    route = route_by_id[args.route]

    if args.live:
        api_key = os.getenv("NSW_FUEL_API_KEY")
        api_secret = os.getenv("NSW_FUEL_API_SECRET")
        if not api_key or not api_secret:
            print(
                "Live mode needs NSW_FUEL_API_KEY and NSW_FUEL_API_SECRET.",
                file=sys.stderr,
            )
            return 2
        try:
            stations = load_live_nsw_prices(api_key, api_secret)
        except (urllib.error.URLError, RuntimeError, TimeoutError) as exc:
            print(f"Live API load failed: {exc}", file=sys.stderr)
            return 1
    else:
        stations_payload = load_json(DATA_DIR / "sample-stations.json")
        stations = stations_payload["stations"]

    eligible_discounts = {
        item.strip()
        for item in args.eligible_discounts.split(",")
        if item.strip()
    }
    candidates, context = score_candidates(
        route=route,
        stations=stations,
        fuel=args.fuel.upper(),
        tank_litres=args.tank_litres,
        tank_percent=args.tank_percent,
        economy_l_per_100km=args.economy,
        reserve_km=args.reserve_km,
        fill_litres=args.fill_litres,
        corridor_km=args.corridor_km,
        detour_factor=args.detour_factor,
        detour_speed_kmh=args.detour_speed_kmh,
        eligible_discounts=eligible_discounts,
        include_member_prices=args.include_member_prices,
        include_closed=args.include_closed,
        baseline_cpl=args.baseline_cpl,
    )

    if args.as_json:
        print(
            json.dumps(
                {
                    "context": context,
                    "recommendations": [
                        candidate_to_dict(candidate)
                        for candidate in candidates[: args.limit]
                    ],
                },
                indent=2,
            )
        )
    else:
        print_table(candidates, context, args.limit)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
