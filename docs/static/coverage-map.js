/**
 * Coverage box visualization, plain JavaScript + SVG — no external library,
 * no map tiles fetched from anywhere. Draws a simple equirectangular
 * lat/lon grid (graticule) with the bounding box highlighted — not a
 * photographic map, but enough to see where on Earth a mission covers,
 * fully self-contained and works with zero network access.
 *
 * container: a DOM element to render into.
 * bbox: { west, south, east, north } in decimal degrees.
 */
function renderCoverageBox(container, bbox) {
  var W = 720, H = 380;
  var padL = 36, padR = 10, padT = 10, padB = 24;
  var plotW = W - padL - padR, plotH = H - padT - padB;

  function xPix(lon) { return padL + ((lon + 180) / 360) * plotW; }
  function yPix(lat) { return padT + ((90 - lat) / 180) * plotH; }

  var parts = [];
  parts.push('<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" class="coverage-svg">');

  // Ocean-ish background
  parts.push('<rect x="' + padL + '" y="' + padT + '" width="' + plotW + '" height="' + plotH + '" class="graticule-bg" />');

  // Longitude gridlines every 30°, latitude every 30°
  for (var lon = -180; lon <= 180; lon += 30) {
    var x = xPix(lon);
    var major = lon === 0;
    parts.push('<line x1="' + x + '" y1="' + padT + '" x2="' + x + '" y2="' + (H - padB) + '" class="' + (major ? 'grid-line-major' : 'grid-line') + '" />');
    parts.push('<text x="' + x + '" y="' + (H - padB + 15) + '" class="axis-tick" text-anchor="middle">' + lon + '\u00b0</text>');
  }
  for (var lat = -90; lat <= 90; lat += 30) {
    var y = yPix(lat);
    var majorLat = lat === 0;
    parts.push('<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" class="' + (majorLat ? 'grid-line-major' : 'grid-line') + '" />');
    parts.push('<text x="' + (padL - 6) + '" y="' + (y + 4) + '" class="axis-tick" text-anchor="end">' + lat + '\u00b0</text>');
  }

  // Bounding box
  var bx0 = xPix(bbox.west), bx1 = xPix(bbox.east);
  var by0 = yPix(bbox.north), by1 = yPix(bbox.south);
  parts.push('<rect x="' + bx0 + '" y="' + by0 + '" width="' + Math.max(bx1 - bx0, 2) + '" height="' + Math.max(by1 - by0, 2) +
    '" class="coverage-box"><title>' + bbox.west + '\u00b0 to ' + bbox.east + '\u00b0 lon, ' + bbox.south + '\u00b0 to ' + bbox.north + '\u00b0 lat</title></rect>');

  parts.push('</svg>');
  container.innerHTML = parts.join('');
}
