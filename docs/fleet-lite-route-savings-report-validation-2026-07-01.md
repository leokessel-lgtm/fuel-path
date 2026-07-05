# Fleet-Lite Route Savings Report Validation

Date: 2026-07-01
Status: validation artefact specified, no fleet SaaS build approved

## Purpose

Fuel Path should test B2B/fleet willingness to pay with a concrete report before building fleet admin, billing, driver management or integrations.

The first artefact is a simple route fuel savings report for 5-10 recurring routes.

## Target Buyer

Primary:

- small fleet owner
- tradie or service business owner
- delivery operator
- office manager exposed to fuel bills

Secondary:

- high-frequency sole trader
- family or household running repeated long commutes

## Offer Hypothesis

Free diagnostic:

- one sample report using 5-10 recurring routes
- assumptions reviewed with the buyer
- no account setup
- no card integration

Paid micro-offer hypothesis:

- AUD 49-149 for a one-off route fuel savings review
- AUD 29-99 per month for a weekly route report if a pilot proves useful

Concierge pilot hypothesis:

- 1-3 operators
- 2-4 weeks
- manual route list
- approved brands/cards recorded as assumptions
- weekly report and one feedback call

## Report Requirements

Each report must show:

- route name that does not expose private addresses
- route distance band or approximate public route description
- fuel type
- approved brand/card assumption, if any
- recommended station
- pump price
- adjusted price
- best price by c/L
- detour minutes
- estimated route value band
- provider/source limitation
- whether the result is actionable, marginal or not worth detouring

Do not show:

- guaranteed dollar savings
- payroll, driver behaviour or compliance claims
- exact employee home addresses
- exact route geometry
- unsupported fleet-card acceptance claims
- public live-price claims for regions without provider evidence

## Success Signal

Treat the artefact as promising only if at least one operator:

- gives a real recurring route list or route pattern
- confirms the report answers a fuel-cost question they already care about
- asks for a follow-up report, pilot or price
- names a policy or card constraint that Fuel Path can support without becoming full fleet management

## Failure Signal

Park or narrow the B2B wedge if:

- the buyer only wants full fleet-card integration
- the buyer needs payroll, driver compliance or enterprise admin first
- the report is interesting but not action-inducing
- provider limitations make the target region unusable
- assumptions need too much manual interpretation to be trusted

## Artefact

Start from:

```text
FLEET-LITE-SAVINGS-REPORT.template.md
```

Fill it manually for the first operator. Build a generator only after the first report produces a follow-up or pilot signal.

## UI/UX Changes Not Yet Approved

The following would need Leo approval before implementation:

- adding a fleet report preview inside Account
- adding a fleet admin or manager mode
- adding driver/team profile controls
- adding report export or sharing controls in the app
- adding policy prompts to Plan beyond the existing approved-brand behaviour
