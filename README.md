# Kiwi Guingueta

Static website for **Kiwi Guingueta** — a beach bar on Passeig Voramar, Vilanova i la Geltrú (Barcelona).

Hand-written HTML, CSS and vanilla JavaScript. No build step, no framework, no runtime dependencies. Deployed to GitHub Pages.

**Live:** https://yourdataweb.github.io/kiwi-guingueta/

---

## Project identity

| Field | Value |
|---|---|
| Code name | `kiwi-guingueta` |
| Domain label | `kiwi-guingueta` (RFC 1123 compliant) |
| Repository | `kiwi-guingueta` |
| S3 prefix | `kiwi-guingueta/` |

The code name is deliberately safe for all three: lowercase, ASCII, hyphen-separated, no leading/trailing hyphen, 14 characters — inside the 63-character DNS label limit and the 3–63 character S3 bucket rule.

## Structure

```
.
├── index.html                  # single page, semantic sections
├── assets/
│   ├── css/styles.css          # theme + layout
│   ├── js/app.js               # hydration from place.json, conditional rules
│   ├── data/place.json         # canonical business data (edit here)
│   └── photos/                 # poster.svg, favicon.svg, fetched photos
├── scripts/fetch-photos.mjs    # resolve Places photo names → local JPEGs
└── .github/workflows/pages.yml # deploy on push to main
```

## Data flow

`assets/data/place.json` is the single source of truth. `app.js` fetches it and hydrates:

- rating badge (only when rating > 4)
- review count (only when count > 50)
- testimonials (reviews rated ≥ 4, longest first, max 3)
- opening hours, with today's row highlighted and live open/closed status
- feature checklist from the Places attribute flags
- contact links, map embed, directions

The HTML ships with static fallbacks, so the page is fully readable if `fetch` fails.

### Conditional rules implemented

| Rule | Location |
|---|---|
| Big star badge only when `rating > 4` | `initRating()` |
| Review count shown only when `user_rating_count > 50` | `initRating()` |
| WhatsApp link only when phone is a mobile | `isMobileNumber()` |
| Testimonials only from reviews ≥ 4 stars | `initReviews()` |

WhatsApp is offered as `https://wa.me/34620187258`. On mobile that opens the app directly; on desktop it opens WhatsApp Web. The link is removed entirely if the number is not detected as a mobile.

## Photos

`raw_photos` in the original API payload contains **photo resource names**, not URLs. They cannot be hotlinked — `places.googleapis.com/v1/{name}/media` requires an API key.

Until photos are resolved, the site uses a hand-drawn SVG poster (`assets/photos/poster.svg`) and a matching favicon. This keeps the page fast, dependency-free, and gives it a coherent look instead of a grey placeholder.

To swap in real photos:

```bash
GOOGLE_MAPS_API_KEY=AIza... node scripts/fetch-photos.mjs --max 8 --width 1600
```

The script downloads into `assets/photos/` and writes `heroPhoto` / `galleryPhotos` into `place.json`. Requires the Places API (New) enabled; billing applies per request.

## Deploying

Push to `main`. The workflow handles the rest.

First-time setup in the repository:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. Push, or run the workflow manually from the Actions tab.

If the repo is under a user account, the site lands at `https://<user>.github.io/kiwi-guingueta/`. All asset paths are relative, so it also works from a subpath or an S3 prefix without changes.

## Local preview

Any static server works:

```bash
python3 -m http.server 8080
# or
npx serve .
```

Then open http://localhost:8080. Opening `index.html` over `file://` will skip the JSON hydration (CORS), but the static fallbacks still render.

## Credits

Business data retrieved from the Google Maps Places API. Review text and reviewer avatars belong to their authors and are shown as attributed testimonials. Map embed is served by Google Maps.
