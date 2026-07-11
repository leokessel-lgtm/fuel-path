# Architecture refactor backlog

This is a ranked extraction backlog, not authority to rewrite all large files at
once. Preserve public contracts and add focused tests before each split.

| Priority | Module | Current concern | First safe extraction |
| --- | --- | --- | --- |
| P0 | `api/_backend.js` | Composition root is reduced to wiring, thin request-domain helpers and compatibility exports | Keep the 300-line boundary ratcheted and reject domain logic regrowth |
| P0 | `api/_geocode.js` | Provider selection, address index and response shaping remain coupled; cache and failure policy are extracted | Extract provider execution adapters behind the existing geocode contract |
| P0 | `api/_addressIndex.js` | Storage access remains coupled; query normalisation and ranking are extracted | Extract SQLite, Postgres and API storage adapters with existing fixtures |
| P1 | `mobile-app/src/components/PlanRouteSheet.tsx` | Recommendation, evidence and action rendering are coupled | Extract result sections without changing wording or route rules |
| P1 | `StationMap.native.tsx` and `StationMap.web.tsx` | Camera, markers, selection and platform rendering are large | Extract shared map selection/camera state; keep renderers platform-specific |
| P1 | `api/ev-chargers.js` | Public handler directly composes multiple EV adapters and policy modules | Move EV orchestration behind one internal contract |
| P1 | `api/status.js` | Public handler reads EV policy and provider observability directly | Export a complete status view from the composition boundary |
| P2 | `NearbyEvControls.tsx` | Provider status, filtering and presentation share one component | Extract pure selection and display models |

With Git history available, `npm run check:architecture` ratchets listed hotspot
limits against `origin/main`, so a file that shrinks cannot regrow to its older
ceiling. Source-only environments without Git metadata enforce the recorded
static ceilings. New production modules use the default ceiling.

The default new-module ceiling is 800 lines. Existing production modules above
that threshold are explicit ratcheted exceptions rather than implicit approval.

Dependency checks cover top-level, cron and push handlers plus common static CommonJS/ES imports, re-exports and
literal dynamic imports. They are a regression guard, not a complete semantic
dependency graph; code review must still reject aliases or computed imports that
cross the documented boundaries.
