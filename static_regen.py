"""
Regenerates docs/catalog.json from data/records/*.yaml.

You normally don't need to run this by hand: the Docker app keeps
docs/catalog.json in sync automatically in the background (see
app/sync.py) whenever it's running with docs/ mounted (see
docker-compose.yml). This script is here for the case where you want to
update the public GitHub Pages mirror without having Docker running —
e.g. right after merging a PR on github.com, from your own machine:

    python static_regen.py
    git add docs/catalog.json
    git commit -m "Update public catalog"
    git push

Only needs PyYAML — no FastAPI/pydantic/Docker required.
"""
import glob
import json
import os

import yaml

RECORDS_DIR = os.path.join(os.path.dirname(__file__), "data", "records")
OUT_PATH = os.path.join(os.path.dirname(__file__), "docs", "catalog.json")


def main():
    records = []
    for path in sorted(glob.glob(os.path.join(RECORDS_DIR, "**", "*.yaml"), recursive=True)):
        with open(path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f)
        if raw:
            # Relative path from data/records/ (e.g. "landsat/landsat-8-oli-tirs.yaml"
            # or just "prisma.yaml" for ungrouped records) — used by the site to build
            # correct "edit on GitHub" / "history on GitHub" links now that records
            # live in per-family subfolders instead of one flat folder.
            raw["_relpath"] = os.path.relpath(path, RECORDS_DIR).replace(os.sep, "/")
            records.append(raw)

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)

    print(f"Wrote {len(records)} records to {OUT_PATH}")


if __name__ == "__main__":
    main()
