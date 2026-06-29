# Map And Geolocation Polish - 21 June 2026

Branch:

```text
backlog/product-hardening-review
```

Latest local app shell:

```text
http://localhost:8081
```

## What Was Tested

Controlled browser geolocation was tested against the Expo web app at `http://127.0.0.1:8081`.

Granted-location pass:

- Plan `Use current location as start` resolves a browser geolocation point.
- Plan shows location evidence for the selected start.
- Nearby `Use current location` resolves the same browser geolocation point.
- Nearby renders Leaflet map tiles and station markers after using current location.
- No browser console warnings or errors were captured during the pass.

Failure-path pass:

- Plan current-location failure before route planning now has a visible alert inside the route editor card.
- Guard added in `mobile-app/scripts/check-map-camera-guards.mjs` so the route editor cannot silently swallow current-location errors again.

## Current Map State

- Expo web app uses Leaflet through `StationMap.web.tsx`.
- Native Android/iOS use `react-native-maps`; Android is configured with Google provider.
- Station markers remain decorative on web and native; station rows own the accessible list semantics.
- Current location is rendered as a separate map pin from the searched centre.
- Programmatic camera movement is separated from user pan/zoom so map-area search is triggered only after a real user gesture.

## Current Geolocation State

- Native current location uses `expo-location`.
- Web current location uses browser `navigator.geolocation`.
- Nearby does not auto-prompt; it only uses already-granted location on load.
- Current location can be triggered manually from Nearby, Plan From, and saved-place editing.
- Browser/native geolocation errors are normalised into plain user-facing messages.

## Remaining Gaps

- iOS map and geolocation validation remains blocked until full Xcode/simctl or physical iOS evidence is available.
- Lower-end Android map/performance validation is still needed before broad public performance claims.
- Manual in-app-browser permission-prompt behaviour should still be checked by a human because automated Chromium permission state does not perfectly match the embedded browser permission sheet.
- Native current-location behaviour with denied permission should be captured on physical Android and iOS, including the exact OS permission copy and recovery path.

## Verification Commands

```bash
cd mobile-app && npm test
cd mobile-app && npm run test:map-camera
cd mobile-app && npm run typecheck
```
