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
  name: "", wavelength_or_frequency: "", spatial_resolution: "", typical_use: "",
  wavelength_nm: null, frequency_ghz: null, bandwidth_nm: null, resolution_m: null,
};

var LOAD_ERRORS = [];

/** Discovers which YAML files exist under data/records/ — no manifest, no
 * manual step. Live: asks GitHub's own API for the repo's file tree.
 * Local: Python's `http.server` auto-generates a directory-listing page
 * for any folder without an index.html, so we fetch and parse that
 * instead — works the same way, zero setup either way. */
function discoverRecordPaths() {
  return discoverFolderPaths("data/records", "yaml");
}

/** Generic version: lists files with a given extension under a given repo
 * folder, live — no manifest, works for both data/records (yaml) and
 * wiki (md). Excludes files/folders starting with "_" (templates). */
function discoverFolderPaths(folder, ext) {
  var promise = IS_LOCAL
    ? _discoverLocalPaths("../" + folder + "/", ext)
    : fetch("https://api.github.com/repos/" + REPO + "/git/trees/" + BRANCH + "?recursive=1")
        .then(function (r) {
          if (!r.ok) throw new Error("GitHub API returned HTTP " + r.status + " while listing " + folder + "/");
          return r.json();
        })
        .then(function (data) {
          var re = new RegExp("^" + folder.replace(/\//g, "\\/") + "\\/.*\\." + ext + "$");
          return (data.tree || [])
            .filter(function (item) { return item.type === "blob" && re.test(item.path); })
            .map(function (item) { return item.path.replace(new RegExp("^" + folder.replace(/\//g, "\\/") + "\\/"), ""); });
        });
  return promise.then(function (paths) {
    return paths.filter(function (p) { return p.split("/").every(function (seg) { return seg.charAt(0) !== "_"; }); });
  });
}

function _discoverLocalPaths(dirUrl, ext) {
  ext = ext || "yaml";
  return fetch(dirUrl)
    .then(function (r) { return r.text(); })
    .then(function (html) {
      var doc = new DOMParser().parseFromString(html, "text/html");
      var links = Array.from(doc.querySelectorAll("a")).map(function (a) { return a.getAttribute("href"); });
      var files = links.filter(function (h) { return h && h.endsWith("." + ext); });
      var subdirs = links.filter(function (h) { return h && h.endsWith("/") && h !== "../" && h !== "./"; });
      return Promise.all(subdirs.map(function (sub) {
        return _discoverLocalPaths(dirUrl + sub, ext).then(function (nestedFiles) {
          return nestedFiles.map(function (f) { return sub + f; });
        });
      })).then(function (nestedLists) {
        var result = files.slice();
        nestedLists.forEach(function (list) { result = result.concat(list); });
        return result;
      });
    });
}

// Fields checked for "missing" — every content field in the schema.
// Excluded on purpose (not "missing", just workflow/system bookkeeping,
// not data about the satellite itself): qa, changelog, verification_status,
// verified_by, verified_at, last_updated, last_updated_by.
var COMPLETENESS_FIELDS = Object.keys(DEFAULTS).filter(function (k) {
  return ["qa", "changelog", "verification_status", "verified_by", "verified_at",
          "last_updated", "last_updated_by"].indexOf(k) === -1;
});

function normalizeDataset(raw, relpath) {
  var d = Object.assign({}, DEFAULTS, raw || {});
  d.bands = (d.bands || []).map(function (b) { return Object.assign({}, BAND_DEFAULTS, b); });
  d._relpath = relpath;
  d._missing = [];
  COMPLETENESS_FIELDS.forEach(function (f) {
    var v = d[f];
    if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) d._missing.push(f);
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
    .then(function (records) {
      // Level records (3+ path segments: family/satellite/level.yaml)
      // don't carry mission_name/agency/etc themselves — those live once
      // in the satellite's _satellite.yaml. Merge them in here so every
      // page (home, families, compare, dataset) sees fully-populated
      // records, not just the individual dataset page.
      var satelliteFolders = {};
      records.forEach(function (d) {
        var parts = (d._relpath || "").split("/");
        if (parts.length >= 3) satelliteFolders[parts.slice(0, -1).join("/")] = true;
      });
      var folders = Object.keys(satelliteFolders);
      if (!folders.length) return records;
      return Promise.all(folders.map(function (folder) {
        return loadSatelliteInfo(folder)
          .then(function (sat) { return { folder: folder, sat: sat }; })
          .catch(function (err) {
            console.error("[satcat] could not load _satellite.yaml for", folder, err);
            LOAD_ERRORS.push({ file: folder + "/_satellite.yaml", message: String(err && err.message ? err.message : err) });
            return { folder: folder, sat: null };
          });
      })).then(function (satResults) {
        var satByFolder = {};
        satResults.forEach(function (r) { satByFolder[r.folder] = r.sat; });
        return records.map(function (d) {
          var parts = (d._relpath || "").split("/");
          if (parts.length < 3) return d;
          var folder = parts.slice(0, -1).join("/");
          var sat = satByFolder[folder];
          return sat ? mergeSatelliteInfo(d, sat) : d;
        });
      });
    })
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

// Fields that live in _satellite.yaml (shared across all levels of a
// satellite) rather than in each level's own file — kept in sync with
// the same list used when authoring records.
var SATELLITE_FIELDS = [
  "mission_name", "sensor_name", "agency", "mission_family", "status",
  "launch_year", "end_of_life_year", "short_description", "long_description",
  "instrument_type", "orbit_type", "thumbnail_url", "internal_contact",
  "tags", "links", "bbox_west", "bbox_south", "bbox_east", "bbox_north",
  "geographic_coverage", "swath_width", "radiometric_resolution",
  "temporal_resolution", "citation_doi",
];

/** For a level record (id/level/bands/access_url/...), fills in the
 * shared satellite-level fields (mission_name, agency, launch_year...)
 * from that satellite's _satellite.yaml wherever the level record itself
 * doesn't already define them. A no-op for flat (non-leveled) records. */
function mergeSatelliteInfo(level, satellite) {
  var merged = Object.assign({}, level);
  SATELLITE_FIELDS.forEach(function (f) {
    var v = merged[f];
    var empty = v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
    if (empty) merged[f] = satellite[f];
  });
  return merged;
}

/** Loads a satellite's shared info (data/records/<folder>/_satellite.yaml)
 * — the file that backs the intermediate "choose a processing level" page.
 * folder is the path relative to data/records/, e.g. "sentinel/sentinel-2-msi". */
function loadSatelliteInfo(folder) {
  return fetch(RAW_BASE + "data/records/" + folder + "/_satellite.yaml")
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + " fetching " + folder + "/_satellite.yaml");
      return r.text();
    })
    .then(function (text) { return normalizeDataset(jsyaml.load(text), folder + "/_satellite.yaml"); });
}

/** Given the full catalog, groups level-records that live in the same
 * satellite subfolder together. A record belongs to a satellite group if
 * its _relpath has at least 2 path segments (family/satellite/level.yaml
 * or satellite/level.yaml) — anything with only 1 segment is a flat,
 * level-less record and stays ungrouped. Returns:
 * { flat: [...datasets without a satellite folder],
 *   satellites: [{ folder, levels: [...datasets] }, ...] } */
function groupBySatellite(datasets) {
  var bySatelliteFolder = {};
  var flat = [];
  datasets.forEach(function (d) {
    var parts = (d._relpath || "").split("/");
    if (parts.length < 3) { flat.push(d); return; }
    var folder = parts.slice(0, -1).join("/");
    (bySatelliteFolder[folder] = bySatelliteFolder[folder] || []).push(d);
  });
  var satellites = Object.keys(bySatelliteFolder).map(function (folder) {
    return { folder: folder, levels: bySatelliteFolder[folder] };
  });
  return { flat: flat, satellites: satellites };
}

/** Opens GitHub's "create new file" page, pre-filled with a template's
 * content, in a new tab — GitHub creates the fork+branch+PR automatically
 * once the user names the file and commits, no git needed on their side. */
function openNewFileOnGitHub(templateRawPath, suggestedPath) {
  fetch(RAW_BASE + templateRawPath)
    .then(function (r) {
      if (!r.ok) throw new Error("Could not load template (HTTP " + r.status + ")");
      return r.text();
    })
    .then(function (content) {
      var url = getRepoUrl() + "/new/" + BRANCH +
        "?filename=" + encodeURIComponent(suggestedPath) +
        "&value=" + encodeURIComponent(content);
      window.open(url, "_blank");
    })
    .catch(function (err) {
      alert("Could not open the template on GitHub: " + err.message + "\nYou can still create the file manually in " + suggestedPath.split("/").slice(0, -1).join("/") + "/.");
    });
}

/** Loads all wiki entries (wiki/*.md), parsed into {slug, title, body}. */
function loadWiki() {
  return discoverFolderPaths("wiki", "md")
    .then(function (relpaths) {
      return Promise.all(relpaths.map(function (relpath) {
        return fetch(RAW_BASE + "wiki/" + relpath)
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status + " fetching " + relpath);
            return r.text();
          })
          .then(function (text) {
            var titleMatch = text.match(/^#\s+(.+)$/m);
            return {
              slug: relpath.replace(/\.md$/, ""),
              title: titleMatch ? titleMatch[1].trim() : relpath.replace(/\.md$/, ""),
              body: text,
            };
          })
          .catch(function (err) {
            console.error("[satcat] could not load wiki entry", relpath, err);
            return null;
          });
      }));
    })
    .then(function (list) { return list.filter(Boolean); });
}

// --- Shared "compare cart" (localStorage), used identically on every page
// so the floating bar and the per-card checkboxes never drift out of sync
// or vanish on pages that forgot to wire their own copy. ---
var MAX_COMPARE = 4;

function getCart() {
  try { return JSON.parse(localStorage.getItem("satcat-compare") || "[]"); }
  catch (e) { return []; }
}
function setCart(c) {
  localStorage.setItem("satcat-compare", JSON.stringify(c));
  renderCompareBar();
}
function toggleCart(id) {
  var c = getCart();
  var i = c.indexOf(id);
  if (i >= 0) { c.splice(i, 1); }
  else {
    if (c.length >= MAX_COMPARE) { return false; }
    c.push(id);
  }
  setCart(c);
  return true;
}
function renderCompareBar() {
  var bar = document.getElementById("compare-bar");
  if (!bar) return;
  var c = getCart();
  document.getElementById("compare-bar-text").textContent =
    c.length + " / " + MAX_COMPARE + (c.length === 1 ? " record selected" : " records selected");
  bar.classList.toggle("visible", c.length > 0);
  document.getElementById("compare-bar-view").disabled = c.length < 2;
  document.querySelectorAll(".compare-checkbox").forEach(function (cb) {
    cb.checked = c.indexOf(cb.value) >= 0;
    cb.disabled = !cb.checked && c.length >= MAX_COMPARE;
  });
}
function wireCompareCheckboxes() {
  renderCompareBar();
  document.querySelectorAll(".compare-checkbox").forEach(function (cb) {
    if (cb.dataset.compareWired) return;
    cb.dataset.compareWired = "1";
    cb.addEventListener("change", function () {
      if (!toggleCart(cb.value)) { cb.checked = false; }
    });
  });
}
function initCompareBar() {
  var bar = document.getElementById("compare-bar");
  if (!bar) return;
  document.getElementById("compare-bar-view").addEventListener("click", function () {
    window.location.href = "compare.html?ids=" + encodeURIComponent(getCart().slice(0, MAX_COMPARE).join(","));
  });
  document.getElementById("compare-bar-clear").addEventListener("click", function () { setCart([]); });
  renderCompareBar();
}
document.addEventListener("DOMContentLoaded", initCompareBar);

// Theme toggle — a single fixed button, bottom-right, on every page,
// created here instead of duplicated HTML/listeners per page.
document.addEventListener("DOMContentLoaded", function () {
  var btn = document.createElement("button");
  btn.id = "theme-toggle";
  btn.className = "icon-btn theme-toggle-fixed";
  btn.type = "button";
  btn.title = "Toggle light/dark theme";
  btn.textContent = "\uD83C\uDF13";
  document.body.appendChild(btn);
  btn.addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("satcat-theme", next);
  });
});
