# Satellite Data Catalog

A team catalog of satellite missions/sensors — what they measure, which
bands, how to access the data, who on the team already knows them — built
as a **static, zero-backend, zero-build site** published on GitHub Pages.

## How it works
- `data/records/` — one YAML file per mission/sensor, the source of truth.
  Grouped into subfolders by family (`landsat/`, `sentinel/`, `msg/`,
  `mtg/`); missions without a family (PRISMA, COSMO-SkyMed) sit directly
  in `data/records/`. Plain text, git-friendly, readable/editable by hand.
- `docs/` — the site itself: plain HTML + JavaScript, no build step, no
  framework, no manifest file to maintain. At page-load time it asks
  GitHub's own API which files exist under `data/records/`, then fetches
  each YAML file's raw content and parses it in the browser (via
  js-yaml). Nothing to regenerate, nothing to list by hand — push a new or
  changed record and it's live on next page load. GitHub Pages publishes
  the `docs/` folder automatically on every push.

## How to contribute
- **Ask a question** → GitHub **Discussions**, from the "Q&A" section on
  any dataset page (pre-fills the dataset ID for you).
- **Request a missing dataset** → open an **Issue** (template included).
- **Add or edit a record** → open a **Pull Request** editing/adding the
  YAML file (in the right subfolder — `data/records/<family>/<id>.yaml`,
  or directly in `data/records/` if it doesn't belong to a family). Each
  dataset page has a "Propose edit on GitHub" button that opens GitHub's
  web editor directly — no git knowledge needed, GitHub creates the
  fork+PR for you. New files are picked up automatically, nothing else to
  update. See `.github/PULL_REQUEST_TEMPLATE.md` for the full review
  checklist.

## Code snippets and Colab notebooks

Each record lists code examples as tabs (`snippets:` in the YAML: `title`, `lang`, optional `description`, `requirements`, `code`). Put the Python example first.
Each `_satellite.yaml` can set `colab_notebook: notebooks/<satellite>.ipynb`. Notebooks are generated from the first Python snippet of each level:

```bash
python tools/build_notebooks.py          # regenerate
python tools/build_notebooks.py --check  # fail if notebooks are stale
```

The "Open in Colab" button needs the repository to be public.
