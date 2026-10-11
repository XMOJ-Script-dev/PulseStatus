# PulseStatus

PulseStatus is a static GitHub Pages status page. Confirmed incidents come from GitHub Issues with explicit labels; Discussions are optional announcement and maintenance supplements. There is no server, database, login, or browser-side GitHub token.

## Local development

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

Set `VITE_BASE_PATH=/REPOSITORY/` for a project Pages site. Leave it `/` for a custom domain. The site uses separate HTML pages, so it does not require SPA fallback.

## Publishing data

The Actions workflow performs a full, paginated Issues refresh. It skips invalid incident labels rather than exposing ambiguous events. `statuspage/incident`, one or more known `service/*`, exactly one `severity/minor|major|critical`, and an optional `state/*` label are required. `state/resolved` or a closed Issue removes an incident from the active list and archives it by its UTC start month.

The default configuration is `manual`, so it never probes service URLs. `scheduled` and `hybrid` services may define a `checkUrl` in the service configuration; checks use bounded timeouts and failures do not erase incident data.

## Badges and embed

```md
![System status](https://XMOJ-Script-dev.github.io/PulseStatus/badges/status.svg)
![Active incidents](https://XMOJ-Script-dev.github.io/PulseStatus/badges/incidents.svg)
```

```html
<script defer src="https://XMOJ-Script-dev.github.io/PulseStatus/embed.js" data-service="all" data-theme="auto"></script>
```

The embed reads only public static data, uses text content, enforces a 60-second minimum polling interval, and displays a neutral unavailable state when data cannot be fetched.

## Administrator checklist

1. Enable GitHub Pages with **GitHub Actions** as the source and approve the `github-pages` environment.
2. Rename the default branch or update the workflow trigger if it is not `main`.
3. Add the required labels: `statuspage/incident`, `statuspage/maintenance`, `service/web`, `service/api`, `service/assets`, `service/docs`, `severity/minor`, `severity/major`, `severity/critical`, `state/investigating`, `state/identified`, `state/monitoring`, and `state/resolved`.
4. The current service configuration is already set: `web` (`https://xmoj-script.uk`, scheduled), `api` (`https://api.xmoj-script.uk`, manual), `assets` (`https://assets.xmoj-script.uk`, manual), and `docs` (`https://docs.xmoj-script.uk`, scheduled).
5. The repository variable `PULSE_TRUSTED_MAINTAINERS` is already set to `PythonSmall-Q,boomzero,langningchen`.
6. If automatic Issue locking is enabled in a custom workflow, grant only `issues: write` and choose a real GitHub lock reason; this project does not invent `resolved` as a reason for active incidents.
7. Confirm Discussions are enabled only if announcement sync is desired; an unavailable Discussions API does not block Issue incidents.
8. Treat generated timestamps as snapshots. GitHub schedule runs can be delayed, and GitHub Pages cannot provide custom CORS headers.

## Limitations

The initial repository data is an explicit empty/unknown snapshot, not demo health. A failed synchronization must fail the workflow or preserve prior published files; it must never publish green status. Public Issue titles, bodies, comments, labels, URLs, and Discussions are untrusted input and are rendered as text.
