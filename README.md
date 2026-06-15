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
docs/*.md     Product, validation, provider and governance notes
```

Most project notes currently live as Markdown files at the repository root. They can move into `docs/` once the monorepo has settled.

## Local Run

Start the local backend:

```sh
python3 web-demo/server.py --host 127.0.0.1 --port 4174 --env prototype/.env
```

Start the app preview:

```sh
cd mobile-app
npm run web -- --port 8082
```

Open:

```text
http://127.0.0.1:8082
```

## Boundaries

- API.NSW credentials stay server-side.
- Public Nominatim lookup is validation-only.
- Production address lookup should use a configured provider adapter behind `/api/geocode`.
- Smart saved-route alerts should be backend push scheduling, not phone-side polling.
