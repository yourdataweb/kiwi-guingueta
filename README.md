# Kiwi Guingueta

Bilingual static website for **Kiwi Guingueta**, a beach bar in Vilanova i la Geltrú (Barcelona).

**Live:** https://yourdataweb.github.io/kiwi-guingueta/
**English:** https://yourdataweb.github.io/kiwi-guingueta/en/

Hand-written HTML, CSS and vanilla JS with a small dependency-free build step. No framework, no runtime dependencies, no client-side rendering.

---

## Project identity

| Field | Value |
|---|---|
| Code name | `kiwi-guingueta` |
| Domain label | `kiwi-guingueta` |
| Repository | `kiwi-guingueta` |
| S3 prefix | `kiwi-guingueta/` |

Lowercase ASCII, hyphen-separated, no edge hyphens, 14 characters — valid as an RFC 1123 DNS label (≤63), a GitHub repository name, and an S3 bucket prefix.

## Structure

```
.
├── src/
│   ├── template.html          # single HTML template with {{i18n}} holes
│   ├── place.json             # business data (edit here)
│   └── i18n/
│       ├── es.json            # Spanish strings (default)
│       └── en.json            # English strings
├── index.html                 # GENERATED — Spanish
├── en/index.html              # GENERATED — English
├── assets/
│   ├── css/styles.css
│   ├── js/app.js              # behaviour only; content is in the HTML
│   ├── data/                  # reserved for future dynamic data
│   └── photos/                # SVG artwork, og.png, touch icon
├── scripts/
│   ├── build.mjs              # renders both locales
│   ├── make-icons.mjs         # og.png + apple-touch-icon.png
│   ├── fetch-photos.mjs       # Places photos → local JPEGs
│   └── verify.mjs             # headless assertions
└── .github/workflows/pages.yml
```

## Build

```bash
node scripts/build.mjs
```

Emits `index.html`, `en/index.html`, `sitemap.xml`, `manifest.webmanifest`, `robots.txt`. The workflow runs this on every push to `main`.

Every locale is **real server-rendered HTML** — not a JS language swap. Each has its own `<html lang>`, canonical URL, `og:locale`, and a correct reciprocal `hreflang` set. Search engines index both independently and no-JS visitors see the full page.

## Localization

Strings live in `src/i18n/{es,en}.json`. Add a key to both files, reference it as `{{section.key}}` in `src/template.html`, rebuild.

- Spanish is the default at `/`
- English at `/en/`
- The switch is a plain link pair, so it works without JavaScript

Dates and numbers are formatted per locale (`4.2` vs `4,2`, `336` vs `336`).

## Conditional business rules

Implemented once in `scripts/build.mjs`, so both locales agree:

| Rule | Behaviour |
|---|---|
| `rating > 4` | Big star badge shown (4.2 → shown) |
| `user_rating_count > 50` | Review count displayed (336 → shown) |
| phone is a mobile | WhatsApp links shown; a landline gets a call link only |
| review rating ≥ 4 | Eligible as a testimonial, longest first, max 3 |

Mobile detection is `+34` followed by 6 or 7 — a Spanish mobile. Anything else is treated as a landline and the WhatsApp affordance is omitted entirely.

## Accessibility

- Landmark structure, single `h1`, sequential headings
- Skip link, visible focus rings
- `aria-expanded` / `aria-controls` on the mobile drawer, Escape closes it
- `aria-label` on icon-only links, with "opens in a new tab" announced
- Decorative SVGs marked `aria-hidden` and `focusable="false"`
- Review text carries its own `lang` attribute when it differs from the page
- Respects `prefers-reduced-motion`; print stylesheet included
- Colour contrast checked against WCAG AA on both themes

## SEO

- Unique title and description per locale
- Reciprocal `hreflang` (es / en / x-default) in HTML and in the sitemap
- Canonical URL per locale
- Open Graph + Twitter card with a generated 1200×630 image
- `BarOrPub` structured data: address, geo, rating, opening hours, `sameAs`
- `robots.txt`, `sitemap.xml`, web manifest

## Photos

`raw_photos` from the Places API are **resource names**, not URLs, and cannot be hotlinked — the media endpoint requires an API key. The site therefore ships a hand-drawn SVG poster, which also keeps it fast and dependency-free.

To use the real photographs:

```bash
GOOGLE_MAPS_API_KEY=AIza... node scripts/fetch-photos.mjs --max 8
node scripts/build.mjs
```

The script downloads into `assets/photos/` and records the paths in `src/place.json`. Requires the Places API (New); billing applies per request.

## Social links

`src/place.json → social` currently holds only the Google Maps listing, because the Places payload contained no other profiles. Add a key and it appears automatically in the header and mobile drawer:

```json
"social": {
  "google": "https://maps.google.com/?cid=…",
  "instagram": "https://instagram.com/…",
  "facebook": "https://facebook.com/…",
  "tiktok": "https://tiktok.com/@…"
}
```

Supported icons: `google`, `instagram`, `facebook`, `tiktok`, `tripadvisor`. Unknown keys are ignored.

## Deploy

Push to `main`; the workflow builds and deploys. First-time repository setup: **Settings → Pages → Source: GitHub Actions**.

All asset paths are relative, so the site also works from a subpath or an S3 prefix unchanged.

## Local preview

```bash
node scripts/build.mjs
python3 -m http.server 8099
```

## Credits

Business data from the Google Maps Places API. Review text and reviewer avatars belong to their authors and are shown as attributed testimonials. Map embed served by Google Maps.
