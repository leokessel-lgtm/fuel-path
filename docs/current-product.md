# Fuel Path current product summary

Last reviewed: 2026-07-10, Australia/Sydney

Fuel Path is an Australia-wide fuel decision product. Its core job is to help a
driver decide whether to fill here, stop on a route, wait, or skip a detour that
is not worth the saving. The map supports that decision; it is not the product
by itself.

## Product focus

1. **Best fuel decision:** rank route-relevant stops using price, detour,
   freshness, eligibility and route quality.
2. **Your real price:** keep pump price visible while showing confirmed user
   discounts separately from possible or unverified offers.
3. **Saved-route usefulness:** support timely route alerts without generic fuel
   spam.
4. **Lean operation:** keep the app fast and place heavy scoring, provider and
   alert work on the backend.

Prediction and fuel-cycle guidance remain evidence-gated. They must not drive
prominent claims without current back-testing.

## Main product surfaces

- `mobile-app/`: primary Expo and React Native application.
- `api/`: provider, geocoding, scoring, alert and readiness logic.
- `web-demo/`: web validation harness, not the primary application surface.
- `prototype/`: older scoring scripts and fixtures used for validation.

## Current work priority

The immediate priority is stabilisation and controlled validation, not broad
feature expansion:

- keep Plan, Nearby, Settings and route recommendation behaviour stable;
- preserve clear recommendation, saving, detour, freshness and eligibility copy;
- collect real-user behaviour evidence before monetisation claims;
- keep native, provider, privacy, store and support gates independently visible;
- retain regression guards for repeated or high-risk failures.

For the detailed work queue, read [`TODO.md`](../TODO.md). For long-term goals
and capability specifications, consult
[`PROJECT-GOALS-ROADMAP.md`](../PROJECT-GOALS-ROADMAP.md) only when the task
requires that depth.

## Claim and release boundaries

- Technical provider access is not provider permission.
- `request sent`, `terms confirmed`, `quality-ready` and
  `beta-release-ready` are separate states.
- Dated evidence proves only the recorded run or review.
- Templates, synthetic sessions and generated synthesis are not primary proof.
- Public live-region, native performance and release-readiness claims require a
  fresh run of the relevant gate with current evidence.

## Read next by task

- Route scoring or recommendation copy: [`route-recommendation-logic-rules.md`](route-recommendation-logic-rules.md)
- Provider integration or permissions: [`03-provider-data/README.md`](03-provider-data/README.md)
- Documentation navigation: [`README.md`](README.md)
- Detailed document classification: [`catalog.md`](catalog.md)
