# PulseStatus configuration reference

PulseStatus is a static site. Configuration is read during the data build and published as JSON/JavaScript under `public/data/`; the browser never reads `config/statuspage.yml` directly.

## Configuration ownership

Keep source configuration in `config/` and keep generated browser data in `public/data/`. Do not edit generated JSON by hand: the next synchronization or build will replace it. A useful ownership split is:

- Operations owns `config/services.json`, monitoring thresholds, trusted maintainers, incident labels, and maintenance data quality.
- Brand or web owners own the `site` section, favicon asset, `src/styles/custom.css`, and localized service text.
- Contributors own page behavior, tests, and the generated data pipeline.

Every configuration change should be checked with `npm run validate-config`, `npm run typecheck`, `npm test`, and `npm run build`.

## Site identity

Edit `config/statuspage.yml`:

| Key | Required | Description |
| --- | --- | --- |
| `site.name` | no | Name shown in the browser title and header. Defaults to `PulseStatus`. |
| `site.locale` | no | Publishing locale metadata. Browser language selection currently supports English and Chinese. |
| `site.timezone` | no | Operational timezone metadata. Daily uptime remains UTC so reports are deterministic. |
| `site.favicon` | no | File path relative to `public/`. Defaults to `favicon.png`. |
| `site.theme` | yes | Administrator-selected built-in template: `modern`, `compact`, `vivid`, or `mono`. |
| `site.companyName` | no | Company or organization name shown in the footer. |
| `site.companyUrl` | no | Optional link for the company name. |
| `site.headerText` | no | Optional text displayed below the global header. |
| `site.footerText` | no | Optional operational or legal text in the footer. |
| `site.footerLinks` | no | YAML list of `{ label, url }` links shown in the footer. |

Example:

```yaml
site:
  name: Acme Service Status
  locale: en
  timezone: America/Los_Angeles
  theme: modern
  favicon: brand/acme-favicon.svg
  companyName: Acme Inc.
  companyUrl: https://acme.example
  headerText: Live availability and incident communication
  footerText: Maintained by the Acme Operations team.
  footerLinks:
    - label: Support
      url: https://acme.example/support
    - label: Privacy
      url: https://acme.example/privacy
```

Place `brand/acme-favicon.svg` at `public/brand/acme-favicon.svg`. Do not use a filesystem path outside `public/`.

The build emits this configuration as `public/data/site.js`. Each HTML entry point loads it before its page module, allowing the same identity and footer to appear on overview, history, incident, and service pages. If `site.js` is missing in a local build, run `npm run build-data`.

The theme is a deployment setting, not a visitor preference. All visitors receive the same `site.theme` value. For organization-specific styling, edit `src/styles/custom.css`; it is bundled after the built-in stylesheet and is therefore the supported override layer.

## Repository and monitoring

The `repository` section identifies the GitHub repository used for Issue synchronization:

```yaml
repository:
  owner: Acme
  name: service-status
```

The `monitoring` section controls probe scheduling and optional automatic Incident publication:

| Key | Description |
| --- | --- |
| `monitoring.mode` | Default mode for services without `monitorMode`: `scheduled`, `manual`, or `hybrid`. |
| `monitoring.schedule` | Documentation/configuration value for the workflow schedule. The workflow currently runs every five minutes. |
| `monitoring.probeIntervalMinutes` | Default minimum interval between real requests. |
| `monitoring.timeoutMs` | Maximum duration of a probe request. |
| `monitoring.failuresToDown` | Consecutive failed probes before a service is considered down. |
| `monitoring.successesToRecover` | Consecutive successful probes before a service recovers. |
| `monitoring.autoPublishIncident` | Enables automatic Incident Issue creation and recovery closure. |
| `monitoring.failuresToIncident` | Consecutive failed probes required to create an automated Incident. |
| `monitoring.recoverySuccessesToCloseIncident` | Consecutive successful probes required to close an automated Incident. |
| `monitoring.historyRetentionDays` | Retention window for probe history. |

Service-level `monitorMode` takes precedence over the default. `manual` services are never probed and cannot trigger automatic incidents.

## Issue policy

```yaml
issues:
  publishLabel: statuspage/incident
  maintenanceLabel: statuspage/maintenance
  autoCloseMaintenance: true
  lockOfficialIncidents: false
  autoIncidentMentions: [oncall-user]
  autoIncidentSeverity: major
  trustedMaintainers: [oncall-user]
  trustedAssociations: [OWNER, MEMBER, COLLABORATOR]
```

`publishLabel` and `maintenanceLabel` are the labels recognized by the synchronizer. `trustedMaintainers` and `trustedAssociations` control which comments can become public operational updates. `autoIncidentSeverity` must be `minor`, `major`, or `critical`.

When `autoCloseMaintenance` is `true`, the workflow closes an open, non-cancelled maintenance Issue after its `Ends at` time. It uses GitHub's `completed` state reason. This applies only to maintenance Issues and does not close manually managed Incidents.

The workflow needs `contents: write` and `issues: write` permissions to persist monitoring state and update Issues.

## History and embed settings

```yaml
history:
  initialMonths: 3
  monthsPerLoad: 3

embed:
  enabled: true
  pollIntervalMs: 300000
```

`initialMonths` and `monthsPerLoad` control the monthly Incident archives loaded by the History page. The embed is read-only and polls published `summary.json`; its browser-side minimum interval is 60 seconds even when a smaller value is configured.

## Services

Edit `config/services.json`. Each service must have a stable unique `id`; the ID is used in GitHub labels (`service/<id>`), generated data, service URLs, and uptime records. `nameI18n` and `descriptionI18n` can provide localized text. `monitorMode` can be `scheduled`, `manual`, or `hybrid`.

Service cards link to:

```text
service.html?id=<id>
```

The detail page filters incidents and maintenance by that same ID. Renaming an ID is therefore a data migration: update labels, existing issue labels, and any links together.

Recommended service configuration:

```json
{
  "id": "api",
  "name": "Public API",
  "nameI18n": { "en": "Public API", "zh": "公共 API" },
  "group": "backend",
  "description": "The API used by public clients.",
  "descriptionI18n": {
    "en": "The API used by public clients.",
    "zh": "供公共客户端使用的 API。"
  },
  "publicUrl": "https://api.example.com",
  "checkUrl": "https://api.example.com/health",
  "monitorMode": "scheduled"
}
```

Use `publicUrl` for a human-facing link and `checkUrl` only for a bounded health check. Services with `monitorMode: manual` are never automatically probed, even when `checkUrl` or `checkIntervalMinutes` is present. They do not increment failure/recovery counters and cannot trigger or automatically close an Incident. Manual services can omit `checkUrl`; they should not be presented as probe-verified.

### Probe frequency

The GitHub Actions workflow runs every five minutes. `monitoring.probeIntervalMinutes` sets the default number of minutes between real requests:

```yaml
monitoring:
  probeIntervalMinutes: 5
```

Individual services can override it:

```json
{
  "id": "docs",
  "monitorMode": "scheduled",
  "checkUrl": "https://docs.example.com/health",
  "checkIntervalMinutes": 10
}
```

The check script persists `lastProbeAt` in `public/data/monitor-state.json`. When an interval has not elapsed, it reuses the last result and does not increment consecutive failure or recovery counters. Counters therefore represent real requests, not workflow invocations. Values below five minutes cannot create more checks with GitHub-hosted schedules; use a dedicated external monitor for sub-five-minute requirements.

Every real request also appends a record to `public/data/probe-history.json`. Existing records are not edited when a new check runs. Each record contains `checkedAt`, the resulting service status, optional `statusCode`, and optional `latencyMs`; manual services are intentionally absent from this history. The service detail page displays the most recent probe records separately from incident-derived uptime.

## Incident and maintenance publishing

Incidents come from valid GitHub Issues with:

1. `statuspage/incident`
2. at least one known `service/<id>`
3. exactly one `severity/minor`, `severity/major`, or `severity/critical`

Maintenance comes from Issues with `statuspage/maintenance`, at least one known service label, and parseable `Starts at`, `Ends at`, and optional `Timezone` fields. The synchronizer writes `incidents-all.json`, `incidents-active.json`, and `maintenance.json`. Set `issues.autoCloseMaintenance: true` to close an open maintenance Issue automatically after its end time. The current repository configuration enables this behavior.

The maintenance parser accepts labels such as `Starts at:` and `Ends at:` followed by ISO timestamps. Always include an explicit offset:

```text
Starts at: 2026-11-01T02:00:00+08:00
Ends at: 2026-11-01T03:30:00+08:00
Timezone: Asia/Singapore
```

Invalid windows are skipped with a warning. A closed maintenance Issue is exported as completed; a `state/cancelled` label is exported as cancelled.

## Service groups

The service directory supports nested groups. `group` is optional: omit it for services that should appear outside a group. Set `parentGroup` on a service when its group belongs below another group. Group defaults and localized labels are configured in `config/statuspage.yml`; Incident and Maintenance sections are never grouped.

```yaml
serviceGroups:
  backend:
    nameI18n:
      en: Backend services
      zh: 后端服务
    defaultExpanded: false
```

For example, a service can place its group below another group:

```json
{
  "id": "api",
  "group": "backend"
}
```

`nameI18n` uses the browser's exact locale first, then its base language, and finally `name` or the group key. The generated service directory uses native accessible disclosure controls. Visitors can still expand or collapse groups while browsing; `defaultExpanded` controls the initial state.

## Automatic Incident publication

Automatic publication is opt-in through `config/statuspage.yml`:

```yaml
monitoring:
  autoPublishIncident: true
  failuresToIncident: 3
  recoverySuccessesToCloseIncident: 2

issues:
  autoIncidentMentions: [PythonSmall-Q]
  autoIncidentSeverity: major
```

The `check-services` step writes the current service result. The `auto-publish-incidents` step then:

1. Loads the previous per-service counters from `public/data/monitor-state.json`.
2. Increments consecutive failures for a `down` monitored service and resets its success counter.
3. Creates one Issue after `failuresToIncident` failures, with `statuspage/incident`, `service/<id>`, the configured severity, and `state/investigating`.
4. Adds each configured username as an `@mention` in the Issue body.
5. Records an HTML marker containing the service ID so later runs do not create duplicates.
6. Increments consecutive successes after recovery and closes the generated Issue after `recoverySuccessesToCloseIncident` successful checks.

Automatic Issues are deliberately normal GitHub Issues, not fabricated browser data. Maintainers should verify customer impact, add context, and close or adjust the Issue as appropriate. Setting `autoPublishIncident: false` prevents new automatic Issues and prevents the automation from closing existing ones.

The workflow commits only the monitor counter file with `[skip ci]`, preventing a state persistence commit from recursively starting another workflow. It requires:

```yaml
permissions:
  contents: write
  issues: write
```

If repository policy disallows workflow pushes, use an external durable state store or disable automatic publication; without persisted counters, consecutive-failure behavior cannot be guaranteed across scheduled runs.

## Uptime calculation

`buildDailyUptime()` calculates each UTC day independently. It finds incidents mentioning a service, clips each interval to the day, sorts and merges overlapping intervals, and subtracts the union of downtime from the elapsed day. Resolved incidents use `closedAt` (falling back to `updatedAt`); active incidents extend to the generated snapshot timestamp.

The output is rounded to three decimal places and capped between 0 and 100. It is intentionally incident-derived and should not be described as synthetic monitoring coverage.

## Build sequence

```bash
npm run validate-config
npm run sync-issues       # requires GitHub Actions environment variables
npm run check-services
npm run build-data
npm run build
```

`build-data` reads the synchronized files and generates summary, incident history, site configuration, and 90 daily uptime records. A failed synchronization must stop the workflow rather than publish a false healthy state.

## GitHub Actions requirements

The publishing job needs permission to read Issues and write the Pages artifact. The synchronization step requires `GITHUB_TOKEN`, `GITHUB_REPOSITORY_OWNER`, and `GITHUB_REPOSITORY`; service configuration is supplied through the repository's existing environment variables. Keep `PULSE_TRUSTED_MAINTAINERS` restricted to maintainers who are allowed to publish operational updates.

If the repository uses a project Pages URL, pass the repository path as `VITE_BASE_PATH`. Verify links from the deployed subdirectory rather than only from `http://localhost:5173/`.
