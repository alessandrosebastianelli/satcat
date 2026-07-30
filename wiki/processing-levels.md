# Processing Levels

Processing level describes how much correction/derivation has already been
applied to a satellite product before you download it — not the same thing
as spatial resolution or product type.

## The common levels

- **L0** — raw instrument data, essentially unusable without specialist
  processing (rarely distributed).
- **L1** (often split into L1A/L1B/L1C) — radiometrically and/or
  geometrically corrected, still in sensor units or top-of-atmosphere
  reflectance. This is usually the lowest level you'd actually download.
- **L2** — geophysical variables derived from L1 (e.g. surface reflectance
  after atmospheric correction, sea surface temperature, NDVI-ready data).
  Most analysis-ready workflows start here.
- **L3** — L2 products mapped onto a regular grid and often composited
  over time (e.g. a cloud-free monthly mosaic).
- **L4** — model output or products combining multiple sources/variables
  (e.g. a merged precipitation or soil-moisture estimate).

## Why it matters when picking a dataset

If you want to compute an index like NDVI yourself, you want **L1**
(so you control the atmospheric correction) or **L2 surface reflectance**
(if you trust the provider's correction and want to save a step). If you
just want a ready-to-use variable (temperature, NDVI, land cover), look
for **L2** or **L3** products instead — no need to reprocess from L1.

## See also

- [Sentinel-2](dataset.html?id=sentinel-2-msi) lists its available
  processing levels under "Data and products".
