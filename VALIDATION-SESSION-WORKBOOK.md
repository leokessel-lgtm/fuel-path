# Fuel Path Validation Session Workbook

Last updated: 13 June 2026, Australia/Sydney

## Purpose

Use this workbook to run real user validation sessions with the Fuel Path live local demo.

The goal is not to sell the idea. The goal is to test whether drivers understand and trust a fuel recommendation that accounts for route, detour, range, price freshness and net saving.

## Status

Real participant sessions: not yet run.

Synthetic dry run: see `SYNTHETIC-VALIDATION-SESSIONS.md`.

## Participant Mix

Target 7 sessions:

| Session | Segment | Target profile |
| --- | --- | --- |
| 1 | Commuter | Drives a repeat Sydney metro route 3+ days/week |
| 2 | Commuter | Family/school-run driver with fuel-price sensitivity |
| 3 | High-frequency driver | Rideshare, delivery or sales rep |
| 4 | High-frequency driver | Tradie or service worker with daily driving |
| 5 | Small fleet | Owner/operator or office manager paying fuel bills |
| 6 | Road trip/regional | Plans longer trips and cares about range |
| 7 | Non-technical price shopper | Uses Petrol Spy/FuelCheck manually but dislikes complexity |

## Pre-Session Checklist

- Rotate API.NSW secret before showing live data.
- Put new credentials only in `prototype/.env`.
- Start the local demo:

```bash
set -a
. prototype/.env
set +a
python3 web-demo/server.py --port 4174
```

- Open:

```text
http://127.0.0.1:4174/web-demo/
```

- Confirm the demo shows `Live NSW API`.
- Explain that this is an internal validation prototype, not a public product.
- Do not promise price accuracy, availability or ACT coverage.

## Moderator Script

Opening:

```text
I am testing whether this kind of fuel recommendation is useful and trustworthy. I am not testing you. Please think aloud and be blunt.
```

Context questions:

1. How often do you fuel?
2. Do you check fuel prices today? If yes, where?
3. Do you usually choose based on price, convenience, brand, loyalty, range or habit?
4. What was the last annoying thing about fuelling?

Demo task:

```text
Imagine this is your route. Look at the recommendation and tell me what you would do.
```

Core questions:

1. Would this change where or when you fuel?
2. Is the recommendation easier than using a map?
3. Is "net saving after detour" clear?
4. What would make you distrust it?
5. What minimum saving is worth a detour?
6. What alert would be useful enough to keep enabled?
7. Would you enter tank level manually?
8. Would you save a regular route?
9. Would loyalty or fuel-card settings matter?
10. Would you pay, tolerate partner offers, or expect it free?

Close:

```text
If this existed tomorrow, when would you actually open it?
```

## Capture Template

```text
Session:
Date:
Participant type:
Route/fuel shown:
Current fuel-checking behaviour:

First reaction:

Did they understand the recommendation?

Did they trust it?

Would it change behaviour?

Minimum saving threshold:

Maximum acceptable detour:

Useful alert:

Main objection:

Requested feature:

Quote:

Evidence strength:
```

## Scoring Rubric

Use 0 to 2 for each:

| Signal | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Understands net saving | Confused | Understands after explanation | Understands immediately |
| Trusts recommendation | Distrusts | Conditional trust | Trusts with source/freshness |
| Behaviour change | No | Maybe | Yes |
| Alert value | No alerts | One narrow alert | Strong saved-route alert need |
| Willingness to configure | No setup | Fuel type only | Tank, route and discounts |
| Monetisation fit | No | Partner offers only | Subscription/fleet willingness |

Proceed only if most real sessions score at least 7/12 and the strongest objections are fixable.

## Synthesis Table

| Session | Segment | Behaviour change | Trust issue | Alert wanted | Saving threshold | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |
| 6 |  |  |  |  |  |  |
| 7 |  |  |  |  |  |  |

## Real Evidence Rules

- Do not count synthetic sessions as validation evidence.
- Do not count polite praise as evidence unless it is tied to a specific behaviour.
- A real "I would use this before my Monday commute" is stronger than "nice app".
- A real "I would not detour for less than $5" is product-shaping evidence.
- Capture objections verbatim.

