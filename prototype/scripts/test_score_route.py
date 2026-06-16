#!/usr/bin/env python3

import unittest
from copy import deepcopy
from datetime import datetime, timezone

from score_route import (
    load_json,
    normalise_nsw_payload,
    normalise_qld_payload,
    score_candidates,
    score_candidates_adaptive,
)
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ScoreRouteTests(unittest.TestCase):
    def setUp(self):
        routes = load_json(ROOT / "data" / "routes.json")["routes"]
        self.route = next(route for route in routes if route["id"] == "parramatta-to-sydney-cbd")
        self.stations = load_json(ROOT / "data" / "sample-stations.json")["stations"]
        self.now = datetime.fromisoformat("2026-06-13T08:00:00+10:00")

    def test_excludes_member_price_by_default(self):
        candidates, _ = score_candidates(
            route=self.route,
            stations=self.stations,
            fuel="U91",
            tank_litres=55,
            tank_percent=50,
            economy_l_per_100km=8,
            reserve_km=30,
            fill_litres=None,
            corridor_km=None,
            detour_factor=1.35,
            detour_speed_kmh=None,
            eligible_discounts=set(),
            include_member_prices=False,
            include_closed=False,
            baseline_cpl=None,
            now=self.now,
        )
        codes = {candidate.station["stationCode"] for candidate in candidates}
        self.assertNotIn("SAMPLE-LIDC-001", codes)

    def test_discount_changes_adjusted_price(self):
        candidates, _ = score_candidates(
            route=self.route,
            stations=self.stations,
            fuel="U91",
            tank_litres=55,
            tank_percent=50,
            economy_l_per_100km=8,
            reserve_km=30,
            fill_litres=30,
            corridor_km=None,
            detour_factor=1.35,
            detour_speed_kmh=None,
            eligible_discounts={"everyday_rewards"},
            include_member_prices=False,
            include_closed=False,
            baseline_cpl=194.0,
            now=self.now,
        )
        granville = next(
            candidate
            for candidate in candidates
            if candidate.station["stationCode"] == "SAMPLE-GRAN-001"
        )
        self.assertAlmostEqual(granville.pump_cpl, 191.9)
        self.assertAlmostEqual(granville.adjusted_cpl, 187.9)

    def test_multiple_selected_discounts_use_best_single_program(self):
        stations = deepcopy(self.stations)
        granville = next(
            station for station in stations if station["stationCode"] == "SAMPLE-GRAN-001"
        )
        granville["discounts"].append(
            {"id": "nrma_ampol", "label": "NRMA / Ampol", "centsPerLitre": 5.0}
        )

        candidates, _ = score_candidates(
            route=self.route,
            stations=stations,
            fuel="U91",
            tank_litres=55,
            tank_percent=50,
            economy_l_per_100km=8,
            reserve_km=30,
            fill_litres=30,
            corridor_km=None,
            detour_factor=1.35,
            detour_speed_kmh=None,
            eligible_discounts={"everyday_rewards", "nrma_ampol"},
            include_member_prices=False,
            include_closed=False,
            baseline_cpl=194.0,
            now=self.now,
        )
        candidate = next(
            item for item in candidates if item.station["stationCode"] == "SAMPLE-GRAN-001"
        )

        self.assertAlmostEqual(candidate.discount_cpl, 5.0)
        self.assertAlmostEqual(candidate.adjusted_cpl, 186.9)
        self.assertIn("discount applied: NRMA / Ampol", candidate.warnings)

    def test_low_tank_marks_later_stops_as_range_risk(self):
        candidates, _ = score_candidates(
            route=self.route,
            stations=self.stations,
            fuel="U91",
            tank_litres=55,
            tank_percent=5,
            economy_l_per_100km=10,
            reserve_km=30,
            fill_litres=None,
            corridor_km=None,
            detour_factor=1.35,
            detour_speed_kmh=None,
            eligible_discounts=set(),
            include_member_prices=False,
            include_closed=False,
            baseline_cpl=None,
            now=self.now,
        )
        self.assertTrue(any(not candidate.reachable for candidate in candidates))

    def test_normalises_api_nsw_station_and_price_collections(self):
        payload = {
            "stations": [
                {
                    "code": "972",
                    "name": "United Petroleum Umina",
                    "brand": "United",
                    "address": "307-313 Ocean Beach Road, UMINA BEACH NSW 2257",
                    "location": {"latitude": -33.511231, "longitude": 151.318092},
                }
            ],
            "prices": [
                {
                    "stationcode": "972",
                    "fueltype": "U91",
                    "price": 181.9,
                    "lastupdated": "13/06/2026 09:45:00",
                }
            ],
        }

        [station] = normalise_nsw_payload(payload)

        self.assertEqual(station["stationCode"], "972")
        self.assertEqual(station["name"], "United Petroleum Umina")
        self.assertEqual(station["suburb"], "Umina Beach")
        self.assertEqual(station["prices"]["U91"], 181.9)
        self.assertTrue(station["updatedAt"].startswith("2026-06-12"))

    def test_normalises_qld_site_price_and_reference_collections(self):
        site_payload = {
            "S": [
                {
                    "S": 61477713,
                    "A": "123 Test Road",
                    "N": "Caltex Brisbane Test",
                    "B": 2,
                    "P": "4000",
                    "G1": 101,
                    "G2": 202,
                    "Lat": -27.4705,
                    "Lng": 153.026,
                    "M": "2026-06-16T00:10:00",
                }
            ]
        }
        price_payload = {
            "SitePrices": [
                {
                    "SiteId": 61477713,
                    "FuelId": 2,
                    "Price": 1679,
                    "TransactionDateUtc": "2026-06-16T00:15:00",
                },
                {
                    "SiteId": 61477713,
                    "FuelId": 12,
                    "Price": 1665,
                    "TransactionDateUtc": "2026-06-16T00:16:00",
                },
                {
                    "SiteId": 61477713,
                    "FuelId": 8,
                    "Price": 9999,
                    "TransactionDateUtc": "2026-06-16T00:17:00",
                },
            ]
        }
        brand_payload = {"Brands": [{"BrandId": 2, "Name": "Caltex"}]}
        region_payload = {
            "GeographicRegions": [
                {"GeoRegionId": 101, "Name": "Brisbane City"},
                {"GeoRegionId": 202, "Name": "Brisbane"},
            ]
        }

        [station] = normalise_qld_payload(
            site_payload,
            price_payload,
            brand_payload,
            region_payload,
        )

        self.assertEqual(station["stationCode"], "QLD-61477713")
        self.assertEqual(station["brand"], "Caltex")
        self.assertEqual(station["suburb"], "Brisbane City")
        self.assertEqual(station["address"], "123 Test Road, Brisbane City, QLD 4000")
        self.assertAlmostEqual(station["prices"]["U91"], 167.9)
        self.assertAlmostEqual(station["prices"]["E10"], 166.5)
        self.assertNotIn("P98", station["prices"])
        self.assertEqual(station["source"], "api_qld_fuelprices")
        self.assertTrue(station["updatedAt"].startswith("2026-06-16"))

    def test_adaptive_corridor_expands_sparse_long_routes(self):
        route = {
            "id": "test-long-route",
            "name": "Test Long Route",
            "points": [
                {"lat": -34.0, "lon": 150.0, "label": "Start"},
                {"lat": -34.0, "lon": 153.0, "label": "End"},
            ],
            "defaultCorridorKm": 2.5,
            "defaultDetourSpeedKmh": 80,
        }
        stations = [
            {
                "stationCode": "TEST-WIDE-001",
                "name": "Wide Corridor Fuel",
                "brand": "Test",
                "suburb": "Route",
                "lat": -33.94,
                "lon": 151.5,
                "openNow": True,
                "membershipRequired": False,
                "prices": {"U91": 185.9},
                "updatedAt": "2026-06-13T07:45:00+10:00",
                "discounts": [],
            }
        ]

        narrow_candidates, narrow_context = score_candidates(
            route=route,
            stations=stations,
            fuel="U91",
            tank_litres=55,
            tank_percent=80,
            economy_l_per_100km=8,
            reserve_km=30,
            fill_litres=30,
            corridor_km=2.5,
            detour_factor=1.35,
            detour_speed_kmh=None,
            eligible_discounts=set(),
            include_member_prices=False,
            include_closed=False,
            baseline_cpl=195.0,
            now=self.now,
        )
        adaptive_candidates, adaptive_context = score_candidates_adaptive(
            route=route,
            stations=stations,
            fuel="U91",
            tank_litres=55,
            tank_percent=80,
            economy_l_per_100km=8,
            reserve_km=30,
            fill_litres=30,
            corridor_km=2.5,
            detour_factor=1.35,
            detour_speed_kmh=None,
            eligible_discounts=set(),
            include_member_prices=False,
            include_closed=False,
            baseline_cpl=195.0,
            now=self.now,
        )

        self.assertEqual(narrow_context["eligibleCandidates"], 0)
        self.assertFalse(narrow_candidates)
        self.assertEqual(adaptive_candidates[0].station["stationCode"], "TEST-WIDE-001")
        self.assertTrue(adaptive_context["corridorExpanded"])
        self.assertGreater(adaptive_context["corridorKm"], 2.5)


if __name__ == "__main__":
    unittest.main()
