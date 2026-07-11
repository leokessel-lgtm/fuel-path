# Fuel Path Design System Direction

Last updated: 14 June 2026

## Design Thesis

Fuel Path should feel like a native map utility, not a form-led website.

The map is the canvas. Cards sit on top of it only when they help the driver make or edit a fuel decision.

## Inspiration Synthesis

The shared pattern across the reference direction is:

- full-screen map as the main surface
- one top search/destination control
- progressive route editing after tapping the search control
- compact bottom card or sheet for the current decision
- price/location markers on the map itself
- one strong brand colour rather than many competing accents
- minimal scrolling outside map movement and result-list interaction

## Core Style

- Primary brand colour: deep fuel green, `#087a63`.
- Supporting colour: charcoal ink, soft map green, amber only for warning/value moments.
- Cards: white or near-white, 8px radius, soft shadow, no nested card stacks.
- Typography: native-app scale, compact and scannable.
- Map markers: brand identity plus price first, rank only where the station is a recommended route stop.

## Plan Screen Pattern

Default state:

- full map
- top floating destination field
- bottom decision sheet with recommendation, saved-route alert, selected station and ranked list

Expanded search state:

- destination field opens into vehicle, fuel, from and to controls
- saved-route and address suggestions appear close to the active field
- Plan route collapses the editor back to the map

Avoid:

- long pre-map forms
- verbose route status text such as route distance and duration in the control area
- repeating map/list sections that feel detached

## Discount Wallet Pattern

Account should support:

- supermarket fuel discounts: Everyday Rewards and Flybuys
- auto/fleet programmes: NRMA/Ampol and Fleet card
- toll organisation offers: Linkt Rewards and time-limited Linkt fuel bonuses
- toll account context: E-Toll captured for future toll-cost and rebate logic, without assuming a fuel discount

Search results should always keep:

- pump price
- user eligible price
- possible lower price
- eligibility caveat

## Open Design Questions

- Whether the bottom decision sheet should become draggable in the native build.
- Whether station filters belong in a map chip row or Account only.
- Whether toll costs should appear in the same route decision as detour fuel cost.
- Whether price-cycle timing belongs in Plan or only in saved-route alerts.

