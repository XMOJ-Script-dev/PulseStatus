# External scheduler Worker

**Language:** English · [简体中文](zh/worker.md)

GitHub does not guarantee scheduled workflow start times. The Worker runs a Cron Trigger every five minutes and dispatches the workflow on that cadence. If a prior workflow is still running, it queues one follow-up instead of dropping the probe; GitHub runner availability can still delay execution.

The `worker/` directory contains a Cloudflare Worker with a five-minute Cron Trigger that dispatches the PulseStatus workflow through the GitHub API. The GitHub-side cron stays enabled as a fallback, so probing continues even if the Worker is removed.

## Architecture

```
Cloudflare Cron Trigger (*/5 * * * *)          GitHub
        │                                       │
        ▼                                       ▼
  pulsestatus-scheduler  ──workflow_dispatch──►  statuspage.yml
  ├─ skip if a run is already queued              (probes services,
  └─ skip if a run started < 4 min ago             publishes data)
```

The Worker never probes your services itself. It only decides *whether to start a workflow run*, using two guards:

- **Queued-run guard** — if a run is already `queued`/`waiting`, the trigger is skipped. If a run is executing and the interval has elapsed, the Worker dispatches one follow-up run; the workflow's concurrency group keeps it pending until the current run finishes.
- **Minimum-spacing guard** — if the most recent run started less than `CRON_MINUTES` minutes ago, the trigger is skipped. The five-minute Cron Trigger aligns with the default spacing.
- Only runs for the configured workflow and branch are considered, so unrelated workflows or branches do not delay probes.
- The scheduled handler safely skips dispatch when the `GITHUB_TOKEN` secret is not configured.

## One-click deploy

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/XMOJ-Script-dev/PulseStatus/tree/main/worker)

1. Create a **fine-grained personal access token** at `github.com/settings/personal-access-tokens/new` with **Actions: Read and write** permission on the status repository (for this repository: `XMOJ-Script-dev/PulseStatus`).
2. Click the button above. Cloudflare clones the `worker/` directory into a repository in your account and opens the deploy page.
3. When prompted for the `GITHUB_TOKEN` secret, paste the token. Review the pre-filled `vars` (owner, repo, workflow file, ref, cron minutes) and adjust them if you forked or renamed anything.
4. Deploy. The Cron Trigger starts immediately.

## Configuration

All values live in `worker/wrangler.jsonc` and can be overridden in the Cloudflare dashboard under **Workers & Pages → pulsestatus-scheduler → Settings → Variables and Secrets**.

| Variable | Default | Meaning |
| --- | --- | --- |
| `GITHUB_TOKEN` | *(secret, no default)* | Fine-grained PAT with `actions: write` on the target repository. Set via the deploy button prompt or `npx wrangler secret put GITHUB_TOKEN`. |
| `GITHUB_OWNER` | `XMOJ-Script-dev` | Repository owner. |
| `GITHUB_REPO` | `PulseStatus` | Repository name. |
| `WORKFLOW_FILE` | `statuspage.yml` | Workflow file name, as accepted by the `workflow_dispatch` API. |
| `GITHUB_REF` | `main` | Branch or tag to dispatch. |
| `CRON_MINUTES` | `5` | Minimum spacing between workflow runs; must match `monitoring.probeIntervalMinutes`. |

## Operations

- **Diagnostics** — open the Worker's URL (`https://pulsestatus-scheduler.<subdomain>.workers.dev/`). It reports whether the token is configured, the effective config, and a *dry-run* decision (`would-dispatch` / `skipped-in-progress` / `skipped-too-recent` / `error`) without dispatching anything.
- **Cron history** — the dashboard shows the last 100 invocations under **Settings → Trigger Events → View events**; logs are in **Workers Logs**.
- **Local development** — `npm install && npm run dev` in `worker/`, then `curl "http://localhost:8787/cdn-cgi/local/scheduled?format=json"` to fire the scheduled handler manually. Put a token in `.dev.vars` (copied from `.dev.vars.example`) to exercise the GitHub calls.

## Security notes

- The token only needs `actions: write` on the one repository. Never grant `contents` or `issues` scopes to this Worker; the workflow itself uses its own `GITHUB_TOKEN` / GitHub App identity for those.
- The PAT is stored as an encrypted Worker secret, never in the repository.
- Anyone can open the Worker's URL, but it only ever performs read-only GitHub API calls and never dispatches on HTTP requests — dispatching happens exclusively in the scheduled handler.
