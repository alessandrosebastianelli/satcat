#!/usr/bin/env python3
"""Regenerates the Google Colab notebooks in notebooks/ from the YAML records.

Every satellite folder under data/records/ whose _satellite.yaml declares
`colab_notebook: notebooks/<name>.ipynb` gets one notebook, built from the
first Python entry of `snippets:` in each of its level files. The YAML stays
the single source of truth: edit a snippet there, run this script, commit
both. Needs only PyYAML.

    python tools/build_notebooks.py          # rewrite notebooks
    python tools/build_notebooks.py --check  # exit 1 if any notebook is stale
"""
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
RECORDS = ROOT / "data" / "records"


def load(path):
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def repo_name():
    cfg = (ROOT / "docs" / "static" / "config.js").read_text(encoding="utf-8")
    m = re.search(r'SATCAT_REPO\s*=\s*"([^"]+)"', cfg)
    return m.group(1) if m else "OWNER/REPO"


def lines(text):
    parts = text.rstrip("\n").split("\n")
    return [p + "\n" for p in parts[:-1]] + [parts[-1]]


def md(text):
    return {"cell_type": "markdown", "metadata": {}, "source": lines(text)}


def code(text):
    return {"cell_type": "code", "metadata": {}, "execution_count": None,
            "outputs": [], "source": lines(text)}


def python_snippet(rec):
    for s in rec.get("snippets") or []:
        if str(s.get("lang", "")).lower() == "python" and s.get("code"):
            return s
    return None


def build(folder, sat, levels, repo):
    owner, name = repo.split("/")
    page = "https://%s.github.io/%s/satellite.html?folder=%s" % (owner, name, folder.relative_to(RECORDS).as_posix())
    title = sat.get("mission_name", folder.name)
    if sat.get("sensor_name"):
        title += " / " + sat["sensor_name"]
    cells = [
        md("# %s\n\nExample notebook from the [Satellite Data Catalog](%s). Each section below runs "
           "the Python example of one processing level.\n\n"
           "Run the cells top to bottom. Some sources need a free account; the cell that needs "
           "credentials asks for them when it runs." % (title, page)),
    ]
    added = 0
    for lv in levels:
        snip = python_snippet(lv)
        if not snip:
            continue
        added += 1
        head = "## %s" % lv.get("level", lv.get("id", ""))
        if lv.get("level_summary"):
            head += "\n\n" + lv["level_summary"]
        if snip.get("description"):
            head += "\n\n" + snip["description"]
        cells.append(md(head))
        reqs = snip.get("requirements") or []
        if reqs:
            cells.append(code("%pip install -q " + " ".join(reqs)))
        cells.append(code(snip["code"]))
    if not added:
        return None
    return {
        "cells": cells,
        "metadata": {
            "colab": {"provenance": []},
            "kernelspec": {"display_name": "Python 3", "name": "python3"},
            "language_info": {"name": "python"},
        },
        "nbformat": 4,
        "nbformat_minor": 4,
    }


def main():
    check = "--check" in sys.argv
    repo = repo_name()
    stale = []
    for sat_file in sorted(RECORDS.rglob("_satellite.yaml")):
        sat = load(sat_file)
        target = sat.get("colab_notebook")
        if not target:
            continue
        folder = sat_file.parent
        levels = [load(p) for p in sorted(folder.glob("*.yaml")) if not p.name.startswith("_")]
        nb = build(folder, sat, levels, repo)
        if nb is None:
            continue
        out = ROOT / target
        text = json.dumps(nb, indent=1, ensure_ascii=False) + "\n"
        if check:
            if not out.exists() or out.read_text(encoding="utf-8") != text:
                stale.append(target)
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
        print("wrote", target)
    if check and stale:
        print("stale notebooks:\n  " + "\n  ".join(stale))
        sys.exit(1)


if __name__ == "__main__":
    main()
