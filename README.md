# Satellite Data Catalog

A team catalog of satellite missions/sensors — what they measure, which
bands, how to access the data, who on the team already knows them — built
as a **static, zero-backend site** published on GitHub Pages.

## How it works
- `data/records/` — one YAML file per mission/sensor, the source of truth.
  Grouped into subfolders by family (`landsat/`, `sentinel/`, `msg/`,
  `mtg/`); missions without a family (PRISMA, COSMO-SkyMed) sit directly
  in `data/records/`. Plain text, git-friendly, readable/editable by hand.
- `docs/catalog.json` — all records combined into one JSON file (found
  recursively across subfolders). This is what the site actually reads
  (plain `fetch()` + `JSON.parse`, no library needed). Regenerate it after
  changing any record:
  ```bash
  python static_regen.py
  ```
  (needs only PyYAML: `pip install pyyaml`)
- `docs/` — the site itself: plain HTML + JavaScript, no build step, no
  framework. GitHub Pages publishes it automatically on every push.

## Contributing
- **Ask a question** → GitHub **Discussions**, from the "Q&A" section on
  any dataset page (pre-fills the dataset ID for you).
- **Request a missing dataset** → open an **Issue** (template included).
- **Add or edit a record** → open a **Pull Request** editing/adding the
  YAML file (in the right subfolder — `data/records/<family>/<id>.yaml`,
  or directly in `data/records/` if it doesn't belong to a family). Each
  dataset page has a "Propose edit on GitHub" button that opens GitHub's
  web editor directly — no git knowledge needed, GitHub creates the
  fork+PR for you. See `.github/PULL_REQUEST_TEMPLATE.md` for the review
  checklist.

## One-time setup (for whoever sets this up)
1. Create the GitHub repo, push this project.
2. Edit `docs/static/config.js` — set `window.SATCAT_REPO` to `"org/repo"`.
   This is the only hardcoded value in the whole site.
3. **Settings → Pages** → Source: "Deploy from a branch" → `main` → `/docs`.
4. **Settings → Features → Discussions** → enable it.
5. **Settings → Branches** → require a review before merging to `main` —
   this is what makes an admin the actual gatekeeper for what goes live.

## Record schema
See `data/records/sentinel-1-c-sar.yaml` or `sentinel-2-msi.yaml` for a
fully filled-out example covering every field. Notable ones:

| Field | Purpose |
|---|---|
| `mission_family` | Groups generations/series together (e.g. "Landsat") — 2+ records sharing a family collapse into one "collection" card on the home page instead of flooding the grid |
| `bands[].wavelength_nm` / `frequency_ghz` + `bandwidth_nm` + `resolution_m` | Powers the spectral band chart (box = bandwidth, height = spatial resolution) |
| `bbox_west/south/east/north` | Optional bounding box, renders a real map on the dataset page. Leave empty for missions without a fixed regional footprint |
| `verification_status` | `unverified` / `verified` — flip it by hand after checking a record's technical details |
| `qa` | Not used on the static site (Q&A lives in GitHub Discussions instead) — kept in the schema for compatibility, safe to ignore |

Controlled vocabularies (instrument types, statuses, etc.) aren't
schema-enforced here — use consistent values across records so filters
work well (check existing records for the conventions in use).

## Testing locally before pushing
```bash
python -m http.server 8000
```
then open `http://localhost:8000/docs/index.html`. Works fully offline —
`catalog.json` is already generated and committed, and the catalog itself
needs no external library.

## Charts and maps
The band chart (Chart.js) and coverage map (Leaflet + OpenStreetMap tiles)
are loaded from `cdnjs.cloudflare.com` — a different provider than
`cdn.jsdelivr.net`, which is what got blocked on the network this was
built against. If cdnjs is blocked too, both widgets show a small
"unavailable" notice instead of breaking the rest of the page — but the
actual map tiles come from `tile.openstreetmap.org` regardless of where
Leaflet itself loads from, so that's a second, independent thing that
could be blocked even if cdnjs works fine for the library files.
