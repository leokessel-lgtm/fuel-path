# Fuel Path UI Aesthetic Implementation Plan

## Direction

Use the reference app as a pattern library, not a visual clone. Fuel Path should keep the accessible default map colour, green-led brand, and route-first product focus while adopting a more premium map-first mobile UI.

## Reference UI Categories

| Category | Reference pattern | Fuel Path translation |
| --- | --- | --- |
| Map canvas | Full-screen map behind most UI | Keep map as the primary surface for Nearby and Plan |
| Floating controls | White translucent panels over map | Use compact floating search, fuel and selected-station controls |
| Bottom sheets | Large rounded sheets anchored low | Make station and route panels feel intentional, not just stacked cards |
| Primary actions | Black high-contrast bars and pills | Add dark thumb-zone actions for route, save and station actions |
| Status chips | Pale lime/yellow delivery tags | Use chips for best value, open now, alert active and price movement |
| Accent line | Bright route line and pins | Keep Fuel Path orange route line with green station selection |
| Icon navigation | Dark pill nav with simple icons | Move bottom nav to icon-first with labels retained for clarity |
| Detail cards | Hero card plus compact cards | Split station detail into price, distance, savings and action sections |
| Illustration | Delivery-specific art | Use only for empty states, never over the map or station list |

## Implementation Sequence

1. Brand foundation
   - Create and use a Fuel Path logo mark.
   - Add stable UI tokens for dark actions, floating surfaces, chips and route accents.
   - Keep map tile colours unchanged for accessibility.

2. App chrome
   - Tighten the header with brand lockup and vehicle pill.
   - Convert bottom navigation to a darker rounded pill with icon-first states.
   - Preserve text labels so navigation remains obvious.

3. Nearby map layer
   - Keep the full-bleed map.
   - Use icon controls for recenter, current location, close and directions.
   - Keep the blue current-location pin and station price markers distinct.

4. Nearby sheet and selected station
   - Redesign the selected station card as the hero surface.
   - Promote distance, adjusted price and best-value status.
   - Move secondary metadata into chips and compact rows.

5. Plan route experience
   - Add clearer start, destination and recommended-stop markers.
   - Use the orange route line as the main story element.
   - Add a dark primary action for saving or starting a route.

6. Account and saved routes
   - Turn saved commutes into compact route cards.
   - Keep alert and redemption states as chips.
   - Avoid decorative layouts that reduce scanning speed.

## Guardrails

- Do not pale out the base map again.
- Keep all map controls usable over complex map areas.
- Keep tap targets at least 44 px where practical.
- Avoid new visual dependencies unless the bundle budget still passes.
- Check web and native parity after each slice.
- Run `npm run verify` and `git diff --check` after every UI slice.

## Next Recommended Slice

Upgrade the bottom navigation into an icon-first dark pill, then restyle the Nearby selected-station hero card. These two changes give the largest visible lift while keeping data and route logic stable.
