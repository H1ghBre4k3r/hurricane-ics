# hurricane-ics

ICS provider and schedule picker for Hurricane Festival.

The deployed app is available at `https://<your-domain>`. It scrapes the
current Hurricane lineup page, lets visitors select artists, and exposes calendar
feeds for the full lineup, individual days, or selected artists.

## Calendar feeds

- Full lineup: <https://<your-domain>/ics>
- Legacy full-lineup alias: <https://<your-domain>/ics/2023>
- Day feeds: `https://<your-domain>/ics/day/thursday`, `/friday`, `/saturday`, `/sunday`
- Selected artists: `https://<your-domain>/ics/artist/?q=<base64-json-artist-array>`
- Shared schedule selection feed: `https://<your-domain>/ics/schedule/<schedule-id>`

The frontend generates `webcal://` subscribe links and copyable `https://` links
for selected artists.

## API endpoints

- `GET /api/concerts` returns the parsed `FestivalPlan`.
- `POST /api/schedule` creates or resolves a shared schedule id for a normalized
  artist list payload (`{ artists: string[] }`).
  - responses are deterministic for equivalent normalized artist sets.
  - legacy `?artists=` links are migrated to the scheduled token flow by the
    frontend when possible.
- `GET /api/schedule/:scheduleId` returns the stored artist payload for a shared schedule id.
  - malformed ids return `400`.
  - unknown/expired ids return `404`.
- `GET /ics/schedule/:scheduleId` returns the artist filtered ICS feed for a shared schedule id.
- `GET /api/status` returns scrape/cache metadata:
  - `staleReason` (null unless upstream refresh is being retried from cache)
  - `cacheAvailable`
  - `lastSuccessfulFetch`
  - `lastAttemptedFetch`
  - `showCount`
  - `lineupDateRange`
  - `lastError`
- `health` currently tracks upstream drift and parse diagnostics:
  - `lineupTimestamp` (current parse marker timestamp)
  - `sourceMarker` (lineup fingerprint)
  - `parsedShowCount`
  - `missingMarkers`
  - `parseWarnings`
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
- Upstream lineup fetch policy (implemented):
  - Source: `https://hurricane.de/line-up/`.
  - Respectful request profile:
    - `User-Agent` must be set on every upstream request.
    - Request is sent with `LINEUP_USER_AGENT`.
    - Default UA: `hurricane-ics-scraper/1.0 (+https://github.com/H1ghBre4k3r/hurricane-ics)`.
    - Effective cache duration: **15 minutes** before a fresh scrape attempt.
    - On upstream failure, the service serves cached data when available and marks response as stale.
    - If no cache exists and upstream fails, API returns a hard failure.
  - This default is intentionally conservative to reduce load on the source and keep data reasonably fresh.
- Optional scrape hardening config:
  - `LINEUP_MARKER_ALLOWLIST` (comma-separated class markers that should remain present).
  - `LINEUP_USER_AGENT` (override the scraper User-Agent string).
  - `DEBUG_PARSER` (`1` to emit parser diagnostics to logs during startup fetch windows).
On `main`, `.github/workflows/Docker.yml` updates the pinned manifest and force-updates
the `deploy/k3s-manifests` branch on each run.

## CI and release checks

- Pull Request flow:
  - All PRs must pass `.github/workflows/PR.yml` (`build-and-test`).
  - This is the required merge gate for all PRs.
  - `pull_request` gate is the required approver of merge readiness.
- Mainline publishing:
  - `.github/workflows/Docker.yml` remains the only workflow updating
    `deploy/k3s-manifests`.
  - `.github/workflows/release-candidate.yml` does **not** push manifests or images.
  - It only runs parse/build/test + static checks and uploads review artifacts.
- One-line action ownership:
  - Required checks: PR.yml, Docker.yml (when applicable on main), release-candidate.
  - `Docker.yml` owns all manifest updates and image publishes.
  - `release-candidate` outputs are for inspection only and are not merge prerequisites for non-PR side effects.
- Release candidate verification:
  - Artifacts are published from PRs targeting `main` and from non-`main` pushes as
    `release-candidate-<commit_sha>`.
  - Use workflow artifacts to inspect `build` and `frontend/build` outputs before approving merges.

## k3s troubleshooting

1. Check process health: `curl https://<your-domain>/healthz`
2. Check scraper/cache status: `curl https://<your-domain>/api/status`
3. Check parsed concerts: `curl https://<your-domain>/api/concerts`
4. Check calendar output: `curl https://<your-domain>/ics`

If `/healthz` is healthy but `showCount` is `0` or `lastError` is set, the app is
running but the upstream lineup fetch or parser likely needs attention.

Use `runbook.md` for deployment/rollback steps and cache troubleshooting.
