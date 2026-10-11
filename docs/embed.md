# Embed integration

Use the static script from the deployed Pages origin:

```html
<script defer src="https://XMOJ-Script-dev.github.io/PulseStatus/embed.js"
  data-service="all" data-theme="auto" data-compact="false"
  data-poll-interval="300000"></script>
```

The script derives its data origin from its own URL rather than the host page. It tries public `summary.json` and renders a neutral `Status unavailable` message when it cannot load. Polling is clamped to at least 60 seconds. GitHub Pages cannot configure arbitrary CORS headers; if cross-origin fetch is blocked, serve a same-origin proxy at the host or use the generated `summary.js` fallback in a custom integration. No JSONP callback is used.
