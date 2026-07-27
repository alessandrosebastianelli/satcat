/**
 * Spectral band chart via Chart.js: X = wavelength (nm, log scale — SAR/
 * radar frequency converted to an equivalent wavelength), Y = spatial
 * resolution (m, linear). Each band is drawn as a colored rectangle
 * (width = bandwidth, height = resolution) via a custom plugin — Chart.js
 * itself only provides the axes/scales/tooltip/legend machinery, since a
 * plain chart type doesn't support "floating rectangles at arbitrary xy".
 *
 * container: a DOM element to render a <canvas> into.
 * datasets: [{ mission, bands: [{name, wavelength_nm, frequency_ghz,
 *              bandwidth_nm, resolution_m, wavelength_or_frequency,
 *              spatial_resolution}] }]
 */
var SPECTRAL_PALETTE = ['#3fb7e0', '#5fd4a0', '#e0a63f', '#e0615f', '#a05fe0', '#5f8ee0', '#e05fa6', '#8fe05f'];
var SPEED_OF_LIGHT_M_S = 299792458;

function _bandCenterNm(b) {
  if (b.wavelength_nm != null) return b.wavelength_nm;
  if (b.frequency_ghz != null) return (SPEED_OF_LIGHT_M_S / (b.frequency_ghz * 1e9)) * 1e9;
  return null;
}
function _bandWidthNm(b, centerNm) {
  if (b.bandwidth_nm != null && b.bandwidth_nm > 0) return b.bandwidth_nm;
  return centerNm * 0.06;
}

var rectPlugin = {
  id: 'bandRects',
  afterDatasetsDraw: function (chart) {
    var ctx = chart.ctx;
    var xScale = chart.scales.x, yScale = chart.scales.y;
    (chart.$bandPoints || []).forEach(function (p) {
      var x0 = xScale.getPixelForValue(p.x0), x1 = xScale.getPixelForValue(p.x1);
      var y0 = yScale.getPixelForValue(p.resolution_m), y1 = yScale.getPixelForValue(0);
      var w = Math.max(x1 - x0, 2), h = Math.max(y1 - y0, 2);
      ctx.save();
      ctx.fillStyle = p.color + 'bf';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(x0, y0, w, h);
      ctx.fill();
      ctx.stroke();
      if (w > 30) {
        ctx.fillStyle = '#0a1015';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, x0 + w / 2, y0 + 13, w - 4);
      }
      ctx.restore();
    });
  },
};

function renderSpectralBandChart(container, datasets, options) {
  options = options || {};
  container.innerHTML = '<canvas></canvas>';
  var canvas = container.querySelector('canvas');

  var points = [];
  datasets.forEach(function (d, idx) {
    (d.bands || []).forEach(function (b) {
      var center = _bandCenterNm(b);
      if (center == null || b.resolution_m == null) return;
      var width = _bandWidthNm(b, center);
      points.push({
        mission: d.mission, name: b.name || '(band)',
        color: options.singleColor || SPECTRAL_PALETTE[idx % SPECTRAL_PALETTE.length],
        x0: center - width / 2, x1: center + width / 2, x: center, resolution_m: b.resolution_m,
        wavelength_or_frequency: b.wavelength_or_frequency || '', spatial_resolution: b.spatial_resolution || '',
      });
    });
  });

  if (!points.length) {
    container.innerHTML = '<p class="hint">No chartable bands (need wavelength/frequency + spatial resolution).</p>';
    return null;
  }

  var xMin = Math.max(Math.min.apply(null, points.map(function (p) { return p.x0; })) * 0.85, 1);
  var xMax = Math.max.apply(null, points.map(function (p) { return p.x1; })) * 1.15;
  var yMax = Math.max.apply(null, points.map(function (p) { return p.resolution_m; })) * 1.15;

  var missions = datasets.filter(function (d) {
    return (d.bands || []).some(function (b) { return _bandCenterNm(b) != null && b.resolution_m != null; });
  });
  var showLegend = missions.length > 1;

  var chart = new Chart(canvas, {
    type: 'scatter',
    data: {
      datasets: missions.map(function (d, i) {
        return {
          label: d.mission,
          data: [],
          backgroundColor: options.singleColor || SPECTRAL_PALETTE[i % SPECTRAL_PALETTE.length],
        };
      }),
    },
    plugins: [rectPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          type: 'logarithmic', min: xMin, max: xMax,
          title: { display: true, text: 'Wavelength (nm, log scale)', color: '#c5d2dd' },
          ticks: { color: '#93a4b5' },
          grid: { color: 'rgba(150,150,150,0.15)' },
        },
        y: {
          type: 'linear', min: 0, max: yMax,
          title: { display: true, text: 'Spatial resolution (m)', color: '#c5d2dd' },
          ticks: { color: '#93a4b5' },
          grid: { color: 'rgba(150,150,150,0.15)' },
        },
      },
      plugins: {
        legend: { display: showLegend, position: 'top', labels: { boxWidth: 12, color: '#c5d2dd' } },
        tooltip: { enabled: false },
      },
      events: [],
    },
  });

  chart.$bandPoints = points;

  // Custom hover tooltip (the bands aren't real Chart.js data points, so
  // Chart.js's own tooltip/interaction system doesn't know about them).
  var tooltipEl = document.createElement('div');
  tooltipEl.className = 'band-tooltip';
  tooltipEl.style.display = 'none';
  container.style.position = 'relative';
  container.appendChild(tooltipEl);

  canvas.addEventListener('mousemove', function (evt) {
    var rect = canvas.getBoundingClientRect();
    var mx = evt.clientX - rect.left, my = evt.clientY - rect.top;
    var hit = null;
    points.forEach(function (p) {
      var x0 = chart.scales.x.getPixelForValue(p.x0), x1 = chart.scales.x.getPixelForValue(p.x1);
      var y0 = chart.scales.y.getPixelForValue(p.resolution_m), y1 = chart.scales.y.getPixelForValue(0);
      if (mx >= x0 && mx <= x1 && my >= y0 && my <= y1) hit = p;
    });
    if (hit) {
      tooltipEl.style.display = 'block';
      tooltipEl.style.left = (mx + 12) + 'px';
      tooltipEl.style.top = (my + 12) + 'px';
      tooltipEl.innerHTML = '<strong>' + (hit.mission ? hit.mission + ' \u2014 ' : '') + hit.name + '</strong>' +
        (hit.wavelength_or_frequency ? '<br>' + hit.wavelength_or_frequency : '') +
        (hit.spatial_resolution ? '<br>Spatial resolution: ' + hit.spatial_resolution : '');
    } else {
      tooltipEl.style.display = 'none';
    }
  });
  canvas.addEventListener('mouseleave', function () { tooltipEl.style.display = 'none'; });

  return chart;
}
