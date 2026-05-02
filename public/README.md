# /public — static assets

Files here are served from the site root at runtime.

## police-academy-logo.png — REQUIRED

Drop the official Police Academy crest here as `police-academy-logo.png`.

The app references it from:

- `<LogoMark />` — every shell, login panel, landing hero, print headers
- `index.html` — favicon + apple-touch-icon

If the file is missing, `<LogoMark />` falls back automatically to an inline SVG approximation so nothing renders broken — but for the demo, drop the real PNG in.

**Recommended:** square PNG, 512×512 or larger, transparent background.
