# Fuel Path repo instructions

## Route recommendation logic documentation

When changing any route recommendation logic, frontend recommendation rules, backend scoring rules, rejection rules, route-saving calculations, Plan result wording, or user-facing savings claims, update:

```text
docs/route-recommendation-logic-rules.md
```

Do this in the same change as the code or copy update.

Examples that require a document update:

- changing `api/_routeScoring.js`
- changing Plan recommendation display in `mobile-app/src/components/PlanRouteSheet.tsx`
- changing `Why this stop` evidence in `mobile-app/src/components/DecisionEvidencePanel.tsx`
- changing route-saving, detour, discount, or comparison wording
- changing what can reject, rank, or down-rank a station
- adding or removing Plan recommendation sections

If the logic document and implementation disagree, treat the implementation as unfinished.

