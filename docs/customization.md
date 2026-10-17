# Branding and CSS customization

This guide covers visual customization without changing application logic. Source changes belong in `config/statuspage.yml`, `public/`, or `src/styles/custom.css`; generated `dist/` assets are disposable.

## CSS entry point

Edit [`src/styles/custom.css`](../src/styles/custom.css). It is imported after `main.css`, so it is the supported place for repository-specific changes. Do not edit generated files under `dist/` or generated data under `public/data/`.

The administrator-selected `site.theme` sets `data-style` on the root element to `modern`, `compact`, `vivid`, or `mono`. Target one built-in style without affecting the others:

```css
html[data-style="modern"] {
  --brand: #0f766e;
  --brand-deep: #115e59;
}
```

To set the same company palette for every style:

```css
:root {
  --brand: #0b5fff;
  --brand-deep: #0645c0;
  --success: #16803c;
}

.brand-mark {
  border-radius: 6px;
}
```

Available core variables include `--surface`, `--border`, `--muted`, `--brand`, `--brand-deep`, `--success`, `--warning`, `--danger`, and `--ink-soft`. Existing selectors cover `.site-header`, `.site-footer`, `.hero`, `.service-card`, `.uptime-card`, `.uptime-day`, `.incident-card`, and `.pill`.

## Theme design tokens

The published site has one administrator-selected theme; visitors do not have a CSS selector or local theme preference. A repository override can target the configured theme, or remain compatible with all four values:

```css
html[data-style="vivid"] .brand-mark {
  background: linear-gradient(135deg, #be123c, #7c2d12);
}

html[data-style="mono"] .card {
  border-radius: 4px;
  box-shadow: none;
}
```

Avoid using only color to communicate an outage. Status pills include text, and uptime cells include accessible labels and browser tooltips. If you change cell colors, retain meaningful light/dark and warning/error differences.

## Fonts and assets

Use a system font stack by default. If the organization owns a font, add it under `public/` and reference it from `custom.css`:

```css
@font-face {
  font-family: "Acme Sans";
  src: url("../fonts/acme-sans.woff2") format("woff2");
  font-display: swap;
}

:root {
  font-family: "Acme Sans", Inter, system-ui, sans-serif;
}
```

For a logo or favicon, add the asset under `public/` and set `site.favicon` in `config/statuspage.yml`. The header mark is intentionally text-based; it can be replaced in CSS or by changing `.brand-mark` with a background image.

### Logo and favicon example

```css
.brand-mark {
  width: 34px;
  height: 34px;
  background: url("/brand/logo-mark.svg") center / contain no-repeat;
  color: transparent;
}
```

Place the asset at `public/brand/logo-mark.svg`. For the browser tab icon, set `site.favicon: brand/favicon.svg`; the build will apply it to every page.

## Layout guidance

The site is responsive at 640px and 760px breakpoints. Prefer fluid sizing, `minmax()`, and the existing layout primitives. Keep service detail content readable on mobile and preserve visible focus outlines for keyboard users.

Do not use CSS to hide incident or maintenance information. Styling can change presentation, but the status page should remain accessible and truthful.

## Testing a customization

```bash
npm run typecheck
npm test
npm run build
npm run dev
```

Open `/`, `/history.html`, and `/service.html?id=web` locally. Select each built-in style and verify that the custom rules still provide adequate contrast, focus visibility, and mobile layout.

## Accessibility and performance checklist

- Keep body text and muted text at readable contrast against `--surface`.
- Preserve `:focus-visible` outlines for links and buttons.
- Test at 320px, 640px, and desktop widths.
- Use `font-display: swap` for custom fonts and avoid large background images.
- Do not hide active incidents, maintenance, or unavailable-state messages.
- Keep external font, image, and analytics requests out of the public status page unless they are operationally necessary.

## Publishing custom styles

1. Edit `src/styles/custom.css`.
2. Run `npm run typecheck`, `npm test`, and `npm run build`.
3. Open all four pages locally and verify the administrator-selected theme is applied consistently.
4. Check the generated `dist/assets/` output and test the deployed base path if using GitHub Pages.
5. Commit the source CSS and any assets under `public/`; never commit a manually edited `dist/` file.
