# Fuel Path

Fuel Path is an app-first fuel decision prototype.

The product direction is:

- best fuel decision, not another map
- real user price, including discounts and eligibility
- smart saved-route alerts
- lean native app with backend-owned scoring and alert intelligence

## Project Structure

```text
mobile-app/   Expo / React Native app shell
web-demo/     Local backend and web validation harness
prototype/    Scoring scripts, sample data and local validation fixtures
docs/         Product, validation, provider, evidence and governance notes
```

The documentation map lives in `docs/README.md`. It identifies current source-of-truth files, dated evidence, research, templates and archive candidates.

## Current Stabilisation Cut

Active local branch:

```text
stabilise/latest-local-build
```

Use this branch as the latest local build branch while stabilising. Do not add new feature scope until the visible Plan, Nearby, Account, web-demo and native smoke flows are clean.

Current latest app shell:

```text
http://localhost:8081
```

The Expo/mobile app shell is the newest UI surface. It has the current Fuel Path logo, top-right vehicle shortcut and native-style tab layout.

Current local web-demo validation harness:

```text
http://localhost:4175/web-demo/
```

The web demo is still useful for route, price-marker and provider validation, but it is not the latest app shell.

Historical stabilisation notes live in `docs/04-validation-evidence/historical/stabilisation-cut-2026-06-21.md`.
The historical repo split between stabilisation, backlog and generated artefacts is recorded in `docs/archive/repository/repo-change-split-2026-06-21.md`.

## Local Run

Start the local backend:

```sh
python3 web-demo/server.py --host 127.0.0.1 --port 4175 --env prototype/.env
```

Start the app preview:

```sh
cd mobile-app
npm run web -- --port 8081
```

Open:

```text
http://127.0.0.1:8081
```

Open the local web demo:

```text
http://127.0.0.1:4175/web-demo/
```

## Vercel Web Demo

The public Vercel deployment serves the Expo web build with sample API endpoints.

```sh
sh scripts/build-vercel-static.sh
```

Vercel uses `vercel.json` to publish the generated `public/` folder and same-origin `/api/*` sample endpoints. Live API.NSW credentials and the local Python backend are intentionally not part of the public deployment.

## Boundaries

- API.NSW credentials stay server-side.
- Public Nominatim lookup is validation-only.
- Production address lookup should use a configured provider adapter behind `/api/geocode`.
- Smart saved-route alerts should be backend push scheduling, not phone-side polling.
