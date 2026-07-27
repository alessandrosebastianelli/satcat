## What does this PR do?
<!-- e.g. "Adds RADARSAT Constellation Mission" or "Fixes Sentinel-2 launch year" -->

## Checklist (for the admin reviewing this)
- [ ] `id` is a unique slug and matches the filename (`data/records/<id>.yaml`)
- [ ] `docs/catalog.json` is up to date with this change — either merge with
      the Docker app running (it updates automatically), or run
      `python static_regen.py` and commit the result
- [ ] Required fields present: `id`, `mission_name`
- [ ] Categorical fields (instrument_type, status, measured_variables, data_format,
      api_type, processing_level) use values from the closed lists in `app/schema.py`
      — not free text
- [ ] Numeric band fields, if present, are actually numeric: `wavelength_nm` (optical)
      or `frequency_ghz` (SAR/radar), plus `resolution_m` — needed for the band chart
- [ ] Sources/links look legitimate (agency site, official docs)
- [ ] `verification_status` — leave as `unverified`; flip to `verified` only after
      you've personally checked the technical details, in a follow-up edit

Once merged, the public site rebuilds automatically within a couple of minutes.
