/**
 * Client-side catalog loader — no build step, no server.
 * Reads manifest.json (list of record file paths, relative to
 * data/records/, including family subfolders) and fetches each YAML
 * file's raw content directly — from raw.githubusercontent.com when the
 * site is live (always fresh, no caching lag, CORS-enabled), or straight
 * off disk when testing on localhost — parses it with js-yaml, and fills
 * in defaults matching the record schema so pages don't break on missing
 * fields.
 *
 * Set window.SATCAT_REPO in static/config.js once, at setup time.
 */
var REPO = window.SATCAT_REPO || "YOUR_ORG/YOUR_REPO";
var BRANCH = "main";

// Local testing: when served from localhost (e.g. `python -m http.server`
// run from the repo root, then open http://localhost:8000/docs/index.html),
// read the YAML files straight off disk via a relative path instead of
// fetching from GitHub — so you can try the whole site before ever pushing.
var IS_LOCAL = ["localhost", "127.0.0.1"].indexOf(window.location.hostname) !== -1;
var RAW_BASE = IS_LOCAL ? "../" : ("https://raw.githubusercontent.com/" + REPO + "/" + BRANCH + "/");

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

/** Discovers which YAML files exist under data/records/ — no manifest, no
 * manual step. Live: asks GitHub's own API for the repo's file tree.
 * Local: Python's `http.server` auto-generates a directory-listing page
 * for any folder without an index.html, so we fetch and parse that
 * instead — works the same way, zero setup either way. */
function discoverRecordPaths() {
  if (IS_LOCAL) {
    return _discoverLocalPaths("../data/records/");
  }
  return fetch("https://api.github.com/repos/" + REPO + "/git/trees/" + BRANCH + "?recursive=1")
    .then(function (r) {
      if (!r.ok) throw new Error("GitHub API returned HTTP " + r.status + " while listing data/records/");
      return r.json();
    })
    .then(function (data) {
      return (data.tree || [])
        .filter(function (item) { return item.type === "blob" && /^data\/records\/.*\.yaml$/.test(item.path); })
        .map(function (item) { return item.path.replace(/^data\/records\//, ""); });
    });
}

function _discoverLocalPaths(dirUrl) {
  return fetch(dirUrl)
    .then(function (r) { return r.text(); })
    .then(function (html) {
      var doc = new DOMParser().parseFromString(html, "text/html");
      var links = Array.from(doc.querySelectorAll("a")).map(function (a) { return a.getAttribute("href"); });
      var yamlFiles = links.filter(function (h) { return h && h.endsWith(".yaml"); });
      var subdirs = links.filter(function (h) { return h && h.endsWith("/") && h !== "../" && h !== "./"; });
      return Promise.all(subdirs.map(function (sub) {
        return _discoverLocalPaths(dirUrl + sub).then(function (nestedFiles) {
          return nestedFiles.map(function (f) { return sub + f; });
        });
      })).then(function (nestedLists) {
        var result = yamlFiles.slice();
        nestedLists.forEach(function (list) { result = result.concat(list); });
        return result;
      });
    });
}

function normalizeDataset(raw, relpath) {
  var d = Object.assign({}, DEFAULTS, raw || {});
  d.bands = (d.bands || []).map(function (b) { return Object.assign({}, BAND_DEFAULTS, b); });
  d._relpath = relpath;
  d._missing = [];
  ["short_description", "instrument_type", "measured_variables", "access_url", "internal_contact"].forEach(function (f) {
    var v = d[f];
    if (!v || (Array.isArray(v) && v.length === 0)) d._missing.push(f);
  });
  return d;
}

/** Loads manifest.json + every listed YAML file. Returns a Promise<Array<dataset>>. */
function loadCatalog() {
  LOAD_ERRORS = [];

  if (typeof jsyaml === "undefined") {
    LOAD_ERRORS.push({
      file: "(library)",
      message: "The js-yaml library did not load (checked cdn.jsdelivr.net). Check your network, or open the browser console for a blocked-request error.",
    });
    return Promise.resolve([]);
  }

  return discoverRecordPaths()
    .then(function (relpaths) {
      return Promise.all(relpaths.map(function (relpath) {
        return fetch(RAW_BASE + "data/records/" + relpath)
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status + " fetching " + RAW_BASE + "data/records/" + relpath);
            return r.text();
          })
          .then(function (text) { return normalizeDataset(jsyaml.load(text), relpath); })
          .catch(function (err) {
            console.error("[satcat] could not load", relpath, err);
            LOAD_ERRORS.push({ file: relpath, message: String(err && err.message ? err.message : err) });
            return null;
          });
      }));
    })
    .then(function (list) { return list.filter(Boolean); })
    .catch(function (err) {
      LOAD_ERRORS.push({ file: "file discovery", message: String(err && err.message ? err.message : err) });
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
  box.innerHTML = "<strong>" + LOAD_ERRORS.length + " item(s) failed to load:</strong><ul>" + items + "</ul>" +
    "<p>Mode: " + (IS_LOCAL ? "local (reading from disk)" : "remote (reading from " + RAW_BASE + ")") + "</p>";
  containerEl.prepend(box);
}

function getRepoUrl() { return "https://github.com/" + REPO; }
