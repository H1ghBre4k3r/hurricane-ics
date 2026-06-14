# hurricane-ics

ICS provider and schedule picker for Hurricane Festival.

The deployed app is available at <https://hurricane.lome.dev>. It scrapes the
current Hurricane lineup page, lets visitors select artists, and exposes calendar
feeds for the full lineup, individual days, or selected artists.

## Calendar feeds

- Full lineup: <https://hurricane.lome.dev/ics>
- Legacy full-lineup alias: <https://hurricane.lome.dev/ics/2023>
- Day feeds: `https://hurricane.lome.dev/ics/day/thursday`, `/friday`, `/saturday`, `/sunday`
- Selected artists: `https://hurricane.lome.dev/ics/artist/?q=<base64-json-artist-array>`

The frontend generates `webcal://` subscribe links and copyable `https://` links
for selected artists.

## API endpoints

- `GET /api/concerts` returns the parsed `FestivalPlan`.
- `GET /api/status` returns scrape/cache metadata:
  - `cacheAvailable`
  - `lastSuccessfulFetch`
  - `lastAttemptedFetch`
  - `showCount`
  - `lineupDateRange`
  - `lastError`
- `GET /healthz` returns `200` when the Express process is running.

## Development

```bash
npm run install-deps
npm test
npm run build
npm start
```

The backend listens on port `3000` and serves the built React frontend from
`frontend/build`.

## Deployment and runtime assumptions

- Node runtime: Node 24.
- Registry workflow publishes to `ghcr.io/h1ghbre4k3r/hurricane-ics`:
  - `latest`
  - `sha-<full-commit>`
- K3s manifests are maintained on `deploy/k3s-manifests` with pinned SHA image tags.
- Optional scrape hardening config:
  - `LINEUP_MARKER_ALLOWLIST` (comma-separated class markers that should remain present).

On `main`, `.github/workflows/Docker.yml` updates the pinned manifest and force-updates
the `deploy/k3s-manifests` branch on each run.

## k3s troubleshooting

1. Check process health: `curl https://hurricane.lome.dev/healthz`
2. Check scraper/cache status: `curl https://hurricane.lome.dev/api/status`
3. Check parsed concerts: `curl https://hurricane.lome.dev/api/concerts`
4. Check calendar output: `curl https://hurricane.lome.dev/ics`

If `/healthz` is healthy but `showCount` is `0` or `lastError` is set, the app is
running but the upstream lineup fetch or parser likely needs attention.

Use `runbook.md` for deployment/rollback steps and cache troubleshooting.
