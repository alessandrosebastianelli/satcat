/**
 * Spectral band chart, plain JavaScript + SVG — no external library.
 * X: wavelength (nm, log scale — SAR/radar frequency converted to an
 *    equivalent wavelength so both fit the same axis).
 * Y: spatial resolution (m, linear).
 * Each band is a colored rectangle: width = bandwidth, height = resolution.
 *
 * container: a DOM element to render into (its innerHTML is replaced).
 * datasets: [{ mission: "...", bands: [{name, wavelength_nm, frequency_ghz,
 *              bandwidth_nm, resolution_m, wavelength_or_frequency,
 *              spatial_resolution}] }]
 */
var SPECTRAL_PALETTE = ['#3fb7e0', '#5fd4a0', '#e0a63f', '#e0615f', '#a05fe0', '#5f8ee0', '#e05fa6', '#8fe05f'];
var SPEED_OF_LIGHT_M_S = 299792458;

function _bandCenterNm(b) {
  if (b.wavelength_nm != null) return b.wavelength_nm;
  if (b.frequency_ghz != null) return (SPEED_OF_LIGHT_M_S / (b.frequency_ghz * 1e9)) * 1e9; // GHz -> equivalent nm
  return null;
}

function _bandWidthNm(b, centerNm) {
  if (b.bandwidth_nm != null && b.bandwidth_nm > 0) return b.bandwidth_nm;
  return centerNm * 0.06; // fallback: a thin visible marker, ~6% of center
}

function renderSpectralBandChart(container, datasets, options) {
  options = options || {};
  container.innerHTML = '';

  var points = []; // { mission, name, x0, x1, resolution_m, wavelength_or_frequency, spatial_resolution }
  datasets.forEach(function (d, idx) {
    (d.bands || []).forEach(function (b) {
      var center = _bandCenterNm(b);
      if (center == null || b.resolution_m == null) return;
      var width = _bandWidthNm(b, center);
      points.push({
        mission: d.mission, name: b.name || '(band)', color: options.singleColor || SPECTRAL_PALETTE[idx % SPECTRAL_PALETTE.length],
        x0: center - width / 2, x1: center + width / 2, resolution_m: b.resolution_m,
        wavelength_or_frequency: b.wavelength_or_frequency || '', spatial_resolution: b.spatial_resolution || '',
      });
    });
  });

  if (!points.length) {
    container.innerHTML = '<p class="hint">No chartable bands (need wavelength/frequency + spatial resolution).</p>';
    return;
  }

  var xMin = Math.min.apply(null, points.map(function (p) { return p.x0; })) * 0.85;
  var xMax = Math.max.apply(null, points.map(function (p) { return p.x1; })) * 1.15;
  var yMax = Math.max.apply(null, points.map(function (p) { return p.resolution_m; })) * 1.15;
  xMin = Math.max(xMin, 1);

  var W = 900, H = 420;
  var padL = 60, padR = 20, padT = 20, padB = 46;
  var plotW = W - padL - padR, plotH = H - padT - padB;

  var logMin = Math.log10(xMin), logMax = Math.log10(xMax);
  function xPix(nm) { return padL + ((Math.log10(Math.max(nm, xMin)) - logMin) / (logMax - logMin)) * plotW; }
  function yPix(m) { return padT + plotH - (m / yMax) * plotH; }

  var svgParts = [];
  svgParts.push('<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" class="spectral-svg">');

  // Y gridlines/ticks (resolution, linear)
  var yTickCount = 5;
  for (var i = 0; i <= yTickCount; i++) {
    var val = (yMax / yTickCount) * i;
    var y = yPix(val);
    svgParts.push('<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" class="grid-line" />');
    svgParts.push('<text x="' + (padL - 8) + '" y="' + (y + 4) + '" class="axis-tick" text-anchor="end">' + Math.round(val) + '</text>');
  }
  // X gridlines/ticks (wavelength, log)
  var decadeStart = Math.floor(logMin), decadeEnd = Math.ceil(logMax);
  for (var dec = decadeStart; dec <= decadeEnd; dec++) {
    [1, 2, 5].forEach(function (mult) {
      var val = mult * Math.pow(10, dec);
      if (val < xMin || val > xMax) return;
      var x = xPix(val);
      svgParts.push('<line x1="' + x + '" y1="' + padT + '" x2="' + x + '" y2="' + (H - padB) + '" class="grid-line" />');
      svgParts.push('<text x="' + x + '" y="' + (H - padB + 16) + '" class="axis-tick" text-anchor="middle">' + (val >= 1000 ? Math.round(val / 1000) + 'k' : Math.round(val)) + '</text>');
    });
  }

  // Axis titles
  svgParts.push('<text x="' + (padL + plotW / 2) + '" y="' + (H - 6) + '" class="axis-title" text-anchor="middle">Wavelength (nm, log scale)</text>');
  svgParts.push('<text x="14" y="' + (padT + plotH / 2) + '" class="axis-title" text-anchor="middle" transform="rotate(-90 14 ' + (padT + plotH / 2) + ')">Spatial resolution (m)</text>');

  // Bars
  points.forEach(function (p, i) {
    var x0 = xPix(p.x0), x1 = xPix(p.x1);
    var w = Math.max(x1 - x0, 2);
    var y0 = yPix(p.resolution_m);
    var h = (H - padB) - y0;
    var titleText = (p.mission ? p.mission + ' \u2014 ' : '') + p.name +
      (p.wavelength_or_frequency ? '\n' + p.wavelength_or_frequency : '') +
      (p.spatial_resolution ? '\nSpatial resolution: ' + p.spatial_resolution : '');
    svgParts.push('<g class="spectral-bar">' +
      '<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + Math.max(h, 2) + '" fill="' + p.color + '" fill-opacity="0.75" stroke="' + p.color + '" stroke-width="1">' +
      '<title>' + titleText.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</title></rect>');
    if (w > 26) {
      svgParts.push('<text x="' + (x0 + w / 2) + '" y="' + (y0 + 13) + '" class="bar-label" text-anchor="middle">' + p.name + '</text>');
    }
    svgParts.push('</g>');
  });

  svgParts.push('</svg>');

  // Legend (only if multiple missions)
  var missions = datasets.filter(function (d) { return (d.bands || []).some(function (b) { return _bandCenterNm(b) != null && b.resolution_m != null; }); });
  var legendHtml = '';
  if (missions.length > 1) {
    legendHtml = '<div class="spectral-legend">' + missions.map(function (d, i) {
      return '<span class="legend-item"><span class="legend-swatch" style="background:' + SPECTRAL_PALETTE[i % SPECTRAL_PALETTE.length] + '"></span>' + d.mission + '</span>';
    }).join('') + '</div>';
  }

  container.innerHTML = legendHtml + svgParts.join('');
}
