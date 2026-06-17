# Route Editor Break-It Test Matrix

## Scope

This matrix covers the Plan Trip route editor and the Account Home/Work editor.
It should be run before marking route-editor work ready for release.

## Acceptance Rules

- A user can always clear, retype and recover a route field without stale route results winning.
- A failed lookup never falls back to a misleading sample route.
- Home, Work, saved routes and recents behave as shortcuts, not as duplicate From/To fields.
- Current location denial or timeout produces a useful recovery message.
- Recent locations are capped, removable and clearable.
- Map-centre refinement only saves after explicit user action.
- Controls expose roles, disabled states, labels and useful hints.
- Timing advice only appears for useful fill/wait decisions; neutral or no-cycle states do not add headline clutter.

## Scenario Matrix

| Priority | Scenario | Break-it action | Expected result |
| --- | --- | --- | --- |
| P0 | Current location denied | Block browser/device location, then tap current location in From and Account Home. | No crash. User sees permission/recovery message. Existing route and saved place are unchanged. |
| P0 | Current location timeout | Simulate slow/unavailable geolocation. | Loading ends. Message suggests retry or typed address. No stale point is saved. |
| P0 | Clear and retype From | Clear From after a successful route, type a weak query, then type a full address. | Route controls expand, old point is cleared, weak lookup does not silently replan, full address can be selected and planned. |
| P0 | Clear and retype To | Same as above for To. | Same behaviour as From. |
| P0 | Swap route | Resolve both endpoints, tap swap repeatedly while route is loading. | Disabled state prevents concurrent swaps. Final route matches visible From/To labels. |
| P0 | Exact address | Search `87a corea street`, select suggestion, plan route. | Exact/local address match is offered and can be planned. |
| P1 | Weak lookup | Search a two-character query, then a misspelled suburb or incomplete street. | Shows shortcuts or an honest no-match/limited lookup state. No false confident route. |
| P1 | POI lookup | Search airports, major shopping centres and CBD landmarks. | Suggestions render as result rows with place metadata, not as extra route fields. |
| P1 | Saved route shortcut | Save a commute, reopen From/To shortcuts, tap saved route endpoints. | Endpoint is applied to the active field and route can be planned. Saved route chip still loads both endpoints. |
| P1 | Home/Work shortcut | Save Home and Work from Account, then use them in Plan. | Home and Work appear as shortcuts and select into the active field. |
| P1 | Home/Work typed edit | Type a Home/Work address in Account, pick a suggestion, then restart app. | Saved place persists and remains available in Plan. |
| P1 | Home/Work map refine | Move the saved-place mini map and tap Save map centre. | Saved place updates only after the explicit save action. |
| P1 | Recents persistence | Select more than eight different suggestions, restart app. | Only the latest eight unique locations persist. |
| P1 | Remove one recent | Remove a recent from the shortcut list. | Removed location disappears without changing Home/Work or saved routes. |
| P1 | Clear recents | Tap Clear recents. | All recent-only shortcuts disappear. Home, Work and saved routes remain. |
| P1 | Timing advice states | Test route scores that return `fill_today_on_route`, `fill_today_with_detour`, `wait_if_can`, `neutral` and `no_cycle_signal`. | Fill/wait states appear as the recommendation title. Neutral and no-cycle states are hidden, with the card falling back to route value copy. |
| P1 | Accessibility labels | Traverse route editor with screen reader or keyboard/web focus. | From, To, swap, clear, current location, suggestions, save Home/Work, remove and clear controls have meaningful labels and states. |
| P2 | Dynamic text | Increase system text size and use narrow mobile width. | Primary controls remain tappable, text truncates cleanly, no horizontal overflow. |
| P2 | Reduced motion | Enable reduced motion and interact with route editor. | Core controls remain usable. Map movement is not required to understand the recommendation. |
| P2 | Offline-ish lookup | Stop backend or force lookup failure while typing. | UI shows lookup failure and lets user retry or edit. |
| P2 | Rapid typing stress | Paste long addresses and rapidly edit both fields. | Latest request wins. No stale suggestions overwrite newer text. |

## Automated Evidence To Run

- `npm run typecheck`
- `npm test`
- `npm run build:web`
- `node --test tests/api/*.test.js`

## Manual Evidence To Capture

- Mobile viewport Plan Trip smoke: From, To, clear, current location denied, exact address, POI, swap, save commute.
- Mobile viewport Account smoke: typed Home/Work, current location denied, clear, map-centre save.
- Accessibility smoke: keyboard/web focus order and screen-reader labels for the route editor controls.
- Privacy smoke: remove one recent and clear all recents without removing Home, Work or saved routes.
