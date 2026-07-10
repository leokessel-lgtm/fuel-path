# Architecture refactor backlog

This is a ranked extraction backlog, not authority to rewrite all large files at
once. Preserve public contracts and add focused tests before each split.

| Priority | Module | Current concern | First safe extraction |
| --- | --- | --- | --- |
| P0 | `api/_backend.js` | Composition root still contains shared HTTP, cache and domain orchestration | Move generic HTTP/parameter utilities, then provider loading orchestration |
| P0 | `api/_geocode.js` | Provider selection, caching, address index and response shaping remain coupled | Extract cache/policy orchestration behind existing geocode contract |
| P0 | `api/_addressIndex.js` | Query parsing, storage access and ranking are one large unit | Extract query normalisation and ranking with existing fixtures |
| P1 | `mobile-app/src/components/PlanRouteSheet.tsx` | Recommendation, evidence and action rendering are coupled | Extract result sections without changing wording or route rules |
| P1 | `StationMap.native.tsx` and `StationMap.web.tsx` | Camera, markers, selection and platform rendering are large | Extract shared map selection/camera state; keep renderers platform-specific |
| P1 | `api/ev-chargers.js` | Public handler directly composes multiple EV adapters and policy modules | Move EV orchestration behind one internal contract |
| P1 | `api/status.js` | Public handler reads EV policy and provider observability directly | Export a complete status view from the composition boundary |
| P2 | `NearbyEvControls.tsx` | Provider status, filtering and presentation share one component | Extract pure selection and display models |

`npm run check:architecture` prevents these files from growing beyond their
recorded baselines and applies a default ceiling to new production modules.
