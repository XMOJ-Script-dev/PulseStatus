# Embed integration

The embed is an optional, read-only status indicator for another website. It does not render the full service directory or incident history. Use the main status page when visitors need service details, daily uptime, incidents, or maintenance.

## Basic installation

Use the static script from the deployed Pages origin:

```html
<script defer src="https://XMOJ-Script-dev.github.io/PulseStatus/embed.js"
  data-service="all" data-theme="auto" data-compact="false"
  data-poll-interval="300000"></script>
```

The script derives its data origin from its own URL rather than the host page. It tries public `summary.json` and renders a neutral `Status unavailable` message when it cannot load. Polling is clamped to at least 60 seconds. GitHub Pages cannot configure arbitrary CORS headers; if cross-origin fetch is blocked, serve a same-origin proxy at the host or use the generated `summary.js` fallback in a custom integration. No JSONP callback is used.

## Attributes

| Attribute | Values | Description |
| --- | --- | --- |
| `data-service` | `all` or a configured service ID | Limits the indicator to one service or shows the overall status. |
| `data-theme` | `auto`, `light`, `dark` | Chooses the embed color scheme. |
| `data-compact` | `true`, `false` | Uses the compact layout when true. |
| `data-poll-interval` | milliseconds | Requested refresh interval; values below 60 seconds are clamped. |

Use one script per indicator and keep the script `defer` attribute so it does not block the host page. The embed reads public data only; it cannot access private GitHub Issues or service credentials.

## Troubleshooting

1. Open the deployed `summary.json` URL directly and confirm it returns JSON.
2. Check the browser console for a cross-origin or Content Security Policy error.
3. Confirm `data-service` exactly matches a service `id`, not its display name.
4. Confirm the Pages origin in the script URL matches the branch and repository that publish the status page.
