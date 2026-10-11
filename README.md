# PulseStatus

> An enterprise-ready, static status and service communications platform for GitHub Pages.

[Use this template](https://github.com/XMOJ-Script-dev/PulseStatus/generate) · [Live example](https://xmoj-script-dev.github.io/PulseStatus/)

PulseStatus turns GitHub Issues into a trustworthy public information center for service status, incidents, planned maintenance, and operational history. It has no server, database, login, or browser-side GitHub token.

## Start from this template

1. Select **Use this template → Create a new repository** and choose your repository name.
2. Edit `config/statuspage.yml` and `config/services.json` with your organization, services, URLs, timezone, and trusted maintainers.
3. Add the labels listed in the administrator checklist below.
4. Enable GitHub Pages with **GitHub Actions** as the source. The first workflow run publishes the site at `https://OWNER.github.io/REPOSITORY/`.
5. Replace the example GitHub link in `src/pages/shared.ts` if your repository is private to the template's example.

The template deliberately starts with an empty, non-demo data snapshot. It never presents fabricated incidents or health metrics.

### Multilingual service directory

Service names and descriptions support locale maps. Keep the plain `name` and `description` as the fallback, then add any locales your audience needs:

```json
{
  "id": "web",
  "name": "Main website",
  "nameI18n": { "en": "Main website", "zh": "主站", "ja": "メインサイト" },
  "description": "The public website.",
  "descriptionI18n": {
    "en": "The public website.",
    "zh": "公开网站。",
    "ja": "公開ウェブサイト。"
  }
}
```

The browser selects the exact locale first, then its base language (for example `zh-CN` → `zh`), and finally falls back to `name` or `description`.

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
