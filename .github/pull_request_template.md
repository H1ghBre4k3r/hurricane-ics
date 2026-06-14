# Hurricane ICS Pull Request

## Summary
Describe what changed and why.

## Checklist
- [ ] I reviewed parser behavior impact and updated fixture expectations.
- [ ] I validated modified ICS routes (`/ics`, `/ics/day/:day`, `/ics/artist`) still render valid feeds.
- [ ] I tested share-link + clipboard copy flow on desktop and mobile (fallback path included).
- [ ] I confirmed stale-cache behavior (`/api/concerts`, `/api/status`) when upstream scrape or parser is degraded.
- [ ] I added or updated tests for every changed behavioral path.
- [ ] I included updated UI screenshots for any frontend changes (desktop + mobile).
- [ ] I reviewed deployment/manifest impact (`k8s/hurricane-ics.yml`) for any packaging or image-tag changes.
- [ ] I updated CI/runbook docs if check requirements changed.

## Notes
If this PR changes deployment behavior, please mention expected manifest updates.
