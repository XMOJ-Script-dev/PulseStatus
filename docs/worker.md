# External scheduler Worker

**Language:** English · [简体中文](zh/worker.md)

GitHub does not guarantee scheduled workflow execution times: on free plans a `*/5` cron may in practice run only a few times per day, which makes sub-hourly probing impossible with the built-in `schedule` trigger alone (see [Probe frequency](configuration.md#probe-frequency) for measurements).

The `worker/` directory contains a Cloudflare Worker that fixes this: a **Cron Trigger runs on time, every time**, and dispatches the PulseStatus workflow through the GitHub API. The GitHub-side cron stays enabled as a fallback, so probing continues even if the Worker is removed.

## Architecture

```
Cloudflare Cron Trigger (*/5 * * * *)        GitHub
        │                                       │
        ▼                                       ▼
  pulsestatus-scheduler  ──workflow_dispatch──►  statuspage.yml
  ├─ skip if a run is in progress                 (probes services,
  └─ skip if a run started < 4 min ago             publishes data)
```

The Worker never probes your services itself. It only decides *whether to start a workflow run*, using two guards:

- **In-progress guard** — if any workflow run is `queued`/`in_progress`, the trigger is skipped. This prevents run pileup, because the workflow runs with `cancel-in-progress: false`.
- **Minimum-spacing guard** — if the most recent run started less than `CRON_MINUTES − 1` minutes ago, the trigger is skipped. This enforces the cadence even when runs finish quickly.

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
| `CRON_MINUTES` | `5` | Expected trigger cadence; the minimum-spacing guard uses `CRON_MINUTES − 1`. Must match the cron in `triggers.crons` and `monitoring.schedule`. |

## Operations

- **Diagnostics** — open the Worker's URL (`https://pulsestatus-scheduler.<subdomain>.workers.dev/`). It reports whether the token is configured, the effective config, and a *dry-run* decision (`would-dispatch` / `skipped-in-progress` / `skipped-too-recent` / `error`) without dispatching anything.
- **Cron history** — the dashboard shows the last 100 invocations under **Settings → Trigger Events → View events**; logs are in **Workers Logs**.
- **Local development** — `npm install && npm run dev` in `worker/`, then `curl "http://localhost:8787/cdn-cgi/local/scheduled?format=json"` to fire the scheduled handler manually. Put a token in `.dev.vars` (copied from `.dev.vars.example`) to exercise the GitHub calls.

## Security notes

- The token only needs `actions: write` on the one repository. Never grant `contents` or `issues` scopes to this Worker; the workflow itself uses its own `GITHUB_TOKEN` / GitHub App identity for those.
- The PAT is stored as an encrypted Worker secret, never in the repository.
- Anyone can open the Worker's URL, but it only ever performs read-only GitHub API calls and never dispatches on HTTP requests — dispatching happens exclusively in the scheduled handler.
