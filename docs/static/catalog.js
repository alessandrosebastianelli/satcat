/**
 * Client-side catalog loader.
 * Reads docs/catalog.json (plain JSON, parsed natively by the browser —
 * no external library needed) generated from data/records/*.yaml.
 *
 * catalog.json is kept fresh automatically by the Docker app's background
 * watcher whenever it's running (see app/sync.py), or can be regenerated
 * by hand with `python static_regen.py` — see docs/static/vendor/README.txt.
 */
var REPO = window.SATCAT_REPO || "YOUR_ORG/YOUR_REPO";

var DEFAULTS = {
  sensor_name: "", agency: "", mission_family: "", status: "Active",
  launch_year: null, end_of_life_year: null, short_description: "", long_description: "",
  instrument_type: "", orbit_type: "", bands: [], spatial_resolution_summary: "",
  temporal_resolution: "", radiometric_resolution: "", swath_width: "",
  processing_level: [], derivable_products: [], measured_variables: [], data_format: [],
  geographic_coverage: "", temporal_range_start: null, temporal_range_end: null,
  bbox_west: null, bbox_south: null, bbox_east: null, bbox_north: null,
  data_latency: "", access_url: "", requires_registration: false, license_cost: "",
  api_type: [], documentation_url: "", download_snippet: "", download_snippet_lang: "python",
  gee_snippet: "", internal_contact: "", related_datasets: [], internal_projects: "",
  notes: "", known_limitations: "", example_use_cases: "", links: [], tags: [],
  citation_doi: "", thumbnail_url: "", extra_sections: [], qa: [], changelog: [],
  verification_status: "unverified", verified_by: "", verified_at: "",
  last_updated: "", last_updated_by: "",
};

var BAND_DEFAULTS = {
  name: "", wavelength_or_frequency: "", spatial_resolution: "",
  wavelength_nm: null, frequency_ghz: null, bandwidth_nm: null, resolution_m: null,
};

var LOAD_ERRORS = [];

function normalizeDataset(raw) {
  var d = Object.assign({}, DEFAULTS, raw || {});
  d.bands = (d.bands || []).map(function (b) { return Object.assign({}, BAND_DEFAULTS, b); });
  d._missing = [];
  ["short_description", "instrument_type", "measured_variables", "access_url", "internal_contact"].forEach(function (f) {
    var v = d[f];
    if (!v || (Array.isArray(v) && v.length === 0)) d._missing.push(f);
  });
  return d;
}

/** Loads catalog.json. Returns a Promise<Array<dataset>>. */
function loadCatalog() {
  LOAD_ERRORS = [];
  return fetch("catalog.json")
    .then(function (r) {
      if (r.status === 404) {
        throw new Error("catalog.json not found. Run `python static_regen.py` from the repo root " +
          "to generate it (see docs/static/vendor/README.txt), or check it was committed to the repo.");
      }
      if (!r.ok) throw new Error("catalog.json returned HTTP " + r.status);
      return r.json();
    })
    .then(function (records) { return records.map(normalizeDataset); })
    .catch(function (err) {
      LOAD_ERRORS.push({ file: "catalog.json", message: String(err && err.message ? err.message : err) });
      return [];
    });
}

/** Renders a visible red banner listing exactly what failed to load, if
 * anything — so the problem shows up on the page itself, no dev tools
 * needed. Call this after loadCatalog() resolves. */
function renderLoadErrorsBanner(containerEl) {
  if (!LOAD_ERRORS.length) return;
  var box = document.createElement("div");
  box.className = "load-error-banner";
  var items = LOAD_ERRORS.map(function (e) {
    return "<li><strong>" + e.file + "</strong>: " + e.message + "</li>";
  }).join("");
  box.innerHTML = "<strong>" + LOAD_ERRORS.length + " item(s) failed to load:</strong><ul>" + items + "</ul>";
  containerEl.prepend(box);
}

function getRepoUrl() { return "https://github.com/" + REPO; }
