## What does this PR do?
<!-- e.g. "Adds RADARSAT Constellation Mission" or "Fixes Sentinel-2 launch year" -->

## Checklist (for the admin reviewing this)
- [ ] File is in the right place: `data/records/<family>/<id>.yaml` if it
      belongs to a family (Landsat, Sentinel, MSG, MTG...), otherwise
      directly in `data/records/<id>.yaml`
- [ ] `id` is a unique slug and matches the filename
- [ ] Required fields present: `id`, `mission_name`
- [ ] Categorical fields (instrument_type, status, measured_variables,
      data_format, api_type, processing_level) use values consistent with
      other existing records — not arbitrary free text, so filters keep working
- [ ] Numeric band fields, if present, are actually numeric: `wavelength_nm`
      (optical) or `frequency_ghz` (SAR/radar), plus `resolution_m` — needed
      for the band chart to plot that band
- [ ] Sources/links look legitimate (agency site, official docs)
- [ ] `verification_status` — leave as `unverified`; flip to `verified` only
      after you've personally checked the technical details, in a follow-up edit
- [ ] **`docs/catalog.json` is regenerated and included in this PR** — run
      `python static_regen.py` locally and commit the result, otherwise the
      public site won't reflect this change after merging

Once merged, GitHub Pages republishes automatically — no other step needed.
