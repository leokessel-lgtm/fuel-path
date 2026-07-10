# Native App Direction

## Decision

Fuel Path should now be designed as a native mobile app first.

The current web demo remains useful as a validation harness because it can test live FuelCheck data, route scoring and product language quickly. It should no longer drive the product shape as a desktop web app.

## Product Shape

Primary app surfaces:

- Plan: vehicle, fuel, saved route, address entry, one recommendation, route map and ranked stops.
- Nearby: classic station map around the driver with fuel and brand filters.
- Account: vehicle profile, discount programs, price eligibilities, notification settings and fleet-lite policy later.

The app should feel like a driver companion, not a data dashboard.

## Native App Reasons

- Saved routes and repeat behaviour are central to the value.
- Push notifications are needed for price, cycle and tank prompts.
- Location permission and navigation handoff are mobile-native behaviours.
- High-frequency drivers need quick repeat use, not a full planning website.
- Future widgets, lock-screen glanceability, CarPlay and Android Auto only make sense from an app-first base.

## Build Direction

Recommended implementation path:

1. Keep the local web demo as the scoring and UX validation harness.
2. Design every new screen as a mobile app screen first.
3. Continue the new Expo / React Native shell now that Plan, Nearby and Account have a first native pass.
4. Keep API.NSW credentials server-side. The mobile app should call a Fuel Path backend, not FuelCheck directly.
5. Keep a web companion later for explainability, fleet/admin, support, data transparency and route preview links.

## Design Guardrails

- One primary action per screen.
- Recommendation first, map/list second.
- Bottom navigation for Plan, Nearby and Account.
- Avoid dashboard density.
- Avoid asking daily users for tank size or economy outside Account setup.
- Explain live price source, freshness and eligibility simply.
- Hand off to navigation rather than becoming a full navigation app.

## Current Prototype Change

The web demo now presents as a mobile app canvas:

- compact app header
- bottom app navigation
- stacked Plan screen
- touch-first map and ranked station list
- live FuelCheck scoring preserved through the local backend

## Current Native Shell

The first native app shell now lives in `mobile-app/`.

- Expo SDK 56 / React Native app scaffold.
- Bottom navigation for Plan, Nearby and Account.
- Nearby screen calls the local Fuel Path backend and renders live station prices.
- Nearby has its own editable location field so drivers can check another suburb, address or place without planning a route.
- Nearby sort labels are Closest, Cheapest and Best value. Best value balances adjusted user price against distance friction.
- Nearby is map-first: the ranked list expands after a ranking control is selected and can collapse back to the map.
- Plan screen accepts from/to fields, calls the local geocode/route/score endpoints, and shows a recommendation plus ranked route stops.
- Plan screen can save the current planned route as a commute and replay saved commute shortcuts.
- Account screen holds vehicle, fuel, discount-program preferences, saved commutes and route alert intent.
- Expo web preview uses Leaflet/OpenStreetMap tiles with branded station price pins, marker selection, route endpoints and real route geometry.
- iOS/Android builds now have a native `react-native-maps` implementation behind the same StationMap API, using Apple Maps on iOS and Google Maps on Android.
- Nearby and Plan Trip current-location actions now use Expo Location foreground permission flow instead of direct browser geolocation.
- Saved commutes persist locally through compact AsyncStorage records capped at 20 routes.
- Route alerts now have an Expo Notifications permission flow, Android channel configuration and daily local notification scheduling on native builds.
- Price-triggered route alert intelligence still needs backend push scheduling and device-build validation before release.
- API.NSW credentials remain server-side in the existing local backend.

This is still a native product shell, not a store-ready app. The web preview map remains Leaflet-based for local browser validation, while iOS/Android builds now have a native map path that still needs device-build validation and production Google Maps Android API-key configuration.

The recommended map/address stack is:

- Native maps: `react-native-maps` for now, because it is included in Expo Go and is the steadier production option than the alpha `expo-maps` package.
- Web preview maps: keep Leaflet/OpenStreetMap as the low-cost validation surface.
- Address search: keep the app calling the Fuel Path backend rather than a third-party provider directly. Use the current `/api/geocode` flow for local validation, then choose a production autocomplete provider, likely Google Places or Mapbox Search, behind the backend once costs, terms and billing controls are confirmed.
- Address autocomplete decision: use Google Places Autocomplete (New) as the preferred production provider behind the Fuel Path backend. Keep Mapbox Search Box as the fallback candidate if Google pricing, terms or coverage prove unsuitable.
- Current implementation: Plan Trip now passes session tokens through `/api/geocode` so the app contract is ready for production autocomplete billing, while Nominatim remains validation-only.

The next product step is implementing the Google Places backend adapter after billing/API-key controls are approved, then validating native route-alert scheduling on iOS/Android and implementing the backend push scheduler design captured in `docs/01-architecture/BACKEND-PUSH-SCHEDULER-DESIGN.md`.

## Performance Direction

Performance is now a standing product goal.

- Keep saved commutes and Account data compact.
- Avoid bundling station datasets, map tiles or oversized logo assets into the native app.
- Avoid native SDKs unless they directly support a core Fuel Path job.
- Keep price-cycle analysis, route scoring and broad data joins on the backend.
- Set iOS and Android app-size baselines after the first EAS preview builds.

See `docs/01-architecture/PERFORMANCE-GUARDRAILS.md`.
