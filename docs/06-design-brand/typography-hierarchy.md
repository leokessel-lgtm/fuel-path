# Fuel Path Typography Hierarchy

Fuel Path is a dense map utility. Typography should help people scan, compare, and act without reducing map visibility.

## Principles

- Use semantic text roles from `mobile-app/src/theme.ts` before adding local `fontSize` or `fontWeight`.
- Keep normal form fields calm. Inputs use `typography.fieldText`: 14px, weight 500.
- Reserve high visual weight for decision signals, not labels.
- Use uppercase sparingly for short section labels and control eyebrows only.
- Prefer 400, 500, 600 and 700 for everyday UI. Use 800 only for numeric decision metrics or tiny constrained labels. Avoid 900 in ordinary controls.
- In Settings, use one page title, then `listTitle` for navigable rows or card titles. Avoid stacking multiple 22px bold headings in the same viewport.

## Roles

| Role | Use | Size | Weight |
| --- | --- | ---: | ---: |
| `typography.title` | Screen titles and major card titles | 22 | 700 |
| `typography.listTitle` | Settings rows and card titles inside settings detail screens | 16 | 700 |
| `typography.bodyStrong` | Station names, vehicle names, compact panel titles | 14 | 600 |
| `typography.fieldText` | Text inputs and selected form values | 14 | 500 |
| `typography.buttonLabel` | Primary buttons and prominent dropdown values | 14 | 700 |
| `typography.compactButtonLabel` | Sort chips, small buttons, compact labels | 12 | 700 |
| `typography.sectionLabel` | Short uppercase labels such as `CURRENT VEHICLE` and `PLAN WITH` | 10 | 700 |
| `typography.metric` | Fuel price, kW, and primary numeric decision signals | 22 | 800 |
| `typography.metadata` | Helper copy, timestamps, secondary details | 12 | 400 |
| `typography.metadataStrong` | Slightly emphasised helper copy or secondary values | 12 | 500 |
| `typography.badgeLabel` | Very short badges and status labels | 10 | 700 |

## Prominence Rules

Prominent:

- fuel price
- best stop or selected station
- route saving and decision value
- primary actions such as `Plan route` and navigation
- selected tab or selected filter state

Quiet:

- field placeholders
- explanatory copy
- section labels
- inactive chips
- sort options
- metadata such as distance and timestamps

## Native App Alignment

This follows native app typography practice by keeping body and input text legible, using clear hierarchy, and letting core content take priority over chrome. Apple and Material guidance both emphasise legibility, hierarchy, and role-based text styles rather than per-component styling.
