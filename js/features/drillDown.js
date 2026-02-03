import { state } from '../state/state.js';
import { supabase, Chart } from '../config/supabase.js';
import { getChildren } from '../services/categoryService.js';
import { formatDateLabel, getAggregationLevel, aggregateData } from '../utils/helpers.js';
import { netWorthFromPercentile } from '../percentile/percentile-financial.js';

/* =========================
   VIEW TRANSITION HELPERS
========================= */

function activateView(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('view-hidden');
  el.classList.add('view-active');
}

function deactivateView(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('view-active');
  el.classList.add('view-hidden');
}

/* =========================
   PERCENTILE CALCULATION & INVERSE
========================= */

function getAgeFactor(age) {
  if (age < 26) return 1.0;
  if (age < 36) return 0.97;
  if (age < 46) return 0.93;
  if (age < 56) return 0.87;
  return 0.80;
}

function bwAdjustment(bodyweight) {
  return Math.pow(180 / bodyweight, 0.12);
}

const PERC_POINTS = [1, 10, 25, 50, 75, 90, 99];

const BASE_RATIOS = {
  bench_press:      [0.20, 0.35, 0.50, 0.60, 0.75, 0.95, 1.25],
  squat:            [0.30, 0.50, 0.70, 0.85, 1.05, 1.30, 1.70],
  deadlift:         [0.35, 0.55, 0.80, 0.95, 1.20, 1.50, 1.90],
  shoulder_press:   [0.12, 0.22, 0.35, 0.45, 0.60, 0.75, 0.95],
  lat_pulldown:     [0.25, 0.40, 0.55, 0.65, 0.80, 0.95, 1.20],
  seated_row_close: [0.30, 0.45, 0.60, 0.70, 0.85, 1.00, 1.25],
  seated_row_wide:  [0.25, 0.40, 0.55, 0.65, 0.80, 0.95, 1.20],
};

const ISOLATION_BASE = {
  lateral_raise:    [5, 8, 12, 15, 20, 25, 35],
  bicep_curl:       [15, 25, 35, 45, 60, 75, 95],
  tricep_extension: [20, 30, 45, 55, 70, 90, 115],
  leg_extension:    [40, 70, 100, 130, 170, 220, 300],
  leg_curl:         [30, 60, 90, 120, 150, 190, 250],
};

function normalizeMetricName(metricName) {
  // Convert "Bench Press" to "bench_press" for lookup
  return metricName.toLowerCase().replace(/\s+/g, '_');
}

function interpolate(percentile, percPoints, values) {
  if (percentile <= percPoints[0]) return values[0];
  if (percentile >= percPoints[percPoints.length - 1]) return values[values.length - 1];
  
  for (let i = 0; i < percPoints.length - 1; i++) {
    if (percentile >= percPoints[i] && percentile <= percPoints[i + 1]) {
      const t = (percentile - percPoints[i]) / (percPoints[i + 1] - percPoints[i]);
      return values[i] + t * (values[i + 1] - values[i]);
    }
  }
  return values[Math.floor(values.length / 2)];
}

function logInterpolate(percentile, percPoints, values) {
  const logValues = values.map(Math.log);
  const logResult = interpolate(percentile, percPoints, logValues);
  return Math.exp(logResult);
}

// FORWARD: Given percentile → Get actual value (lbs) for POPULATION
function getActualValueFromPercentile(percentile, metricName, userAge, userBodyweight) {
  const age = userAge || 30;
  const bodyweight = userBodyweight || 180;
  const ageFactor = getAgeFactor(age);
  const normalizedName = normalizeMetricName(metricName);
  
  // Handle financial metrics
  if (normalizedName === 'networth' || normalizedName === 'net_worth') {
    const ageGroup = getAgeGroupForNetWorth(age);
    const value = netWorthFromPercentile(percentile, ageGroup);
    return Math.round(value);
  }
  
  if (BASE_RATIOS[normalizedName]) {
    const bwAdj = bwAdjustment(bodyweight);
    const ratio = logInterpolate(percentile, PERC_POINTS, BASE_RATIOS[normalizedName]);
    const oneRM = ratio * bodyweight * bwAdj * ageFactor;
    return Math.round(oneRM);
  }
  
  if (ISOLATION_BASE[normalizedName]) {
    const bwAdj = Math.sqrt(bodyweight / 135);
    const baseValue = interpolate(percentile, PERC_POINTS, ISOLATION_BASE[normalizedName]);
    const oneRM = baseValue * bwAdj * ageFactor;
    return Math.round(oneRM);
  }
  
  if (normalizedName === 'run_5k') {
    const benchmarks = [40, 30, 25, 22, 20, 18, 16];
    const adjusted = benchmarks.map(b => b / ageFactor);
    const minutes = interpolate(100 - percentile, PERC_POINTS, adjusted);
    return Math.round(minutes * 10) / 10;
  }
  
  return percentile;
}

// Helper to map age to age group for net worth
function getAgeGroupForNetWorth(age) {
  if (age < 30) return "20s";
  if (age < 40) return "30s";
  if (age < 50) return "40s";
  if (age < 60) return "50s";
  return "60s";
}

// REVERSE: Given actual value (lbs) → Get percentile in POPULATION
function getPercentileFromActualValue(actualValue, metricName, userAge, userBodyweight) {
  const age = userAge || 30;
  const bodyweight = userBodyweight || 180;
  const ageFactor = getAgeFactor(age);
  
  if (BASE_RATIOS[metricName]) {
    const bwAdj = bwAdjustment(bodyweight);
    const normalizedRatio = actualValue / (bodyweight * bwAdj * ageFactor);
    
    const ratios = BASE_RATIOS[metricName];
    for (let i = 0; i < PERC_POINTS.length - 1; i++) {
      const logRatio1 = Math.log(ratios[i]);
      const logRatio2 = Math.log(ratios[i + 1]);
      const logNorm = Math.log(normalizedRatio);
      
      if (logNorm >= logRatio1 && logNorm <= logRatio2) {
        const t = (logNorm - logRatio1) / (logRatio2 - logRatio1);
        return PERC_POINTS[i] + t * (PERC_POINTS[i + 1] - PERC_POINTS[i]);
      }
    }
    
    if (normalizedRatio < ratios[0]) return PERC_POINTS[0];
    if (normalizedRatio > ratios[ratios.length - 1]) return PERC_POINTS[PERC_POINTS.length - 1];
  }
  
  if (ISOLATION_BASE[metricName]) {
    const bwAdj = Math.sqrt(bodyweight / 135);
    const normalized = actualValue / (bwAdj * ageFactor);
    
    const values = ISOLATION_BASE[metricName];
    for (let i = 0; i < PERC_POINTS.length - 1; i++) {
      if (normalized >= values[i] && normalized <= values[i + 1]) {
        const t = (normalized - values[i]) / (values[i + 1] - values[i]);
        return PERC_POINTS[i] + t * (PERC_POINTS[i + 1] - PERC_POINTS[i]);
      }
    }
    
    if (normalized < values[0]) return PERC_POINTS[0];
    if (normalized > values[values.length - 1]) return PERC_POINTS[PERC_POINTS.length - 1];
  }
  
  return 50;
}

function getUnitForMetric(metricName) {
  const normalized = normalizeMetricName(metricName);
  if (normalized === 'networth' || normalized === 'net_worth' || normalized === 'income') return '$';
  if (metricName === 'run_5k') return 'min';
  if (BASE_RATIOS[normalized] || ISOLATION_BASE[normalized]) return 'lbs';
  return '';
}

/* =========================
   DISTRIBUTION GENERATION
========================= */

function generateRealDistribution(percentiles) {
  const bins = new Array(101).fill(0);
  
  percentiles.forEach(p => {
    const bin = Math.round(Math.max(0, Math.min(100, p)));
    bins[bin]++;
  });
  
  const smoothed = gaussianSmooth(bins, 1.0);
  
  const maxVal = Math.max(...smoothed);
  const normalized = maxVal > 0 ? smoothed.map(v => (v / maxVal) * 100) : smoothed;
  
  let cumulative = 0;
  const cdf = smoothed.map(val => {
    cumulative += val;
    return cumulative;
  });
  const total = cdf[cdf.length - 1];
  const normalizedCDF = total > 0 ? cdf.map(c => (c / total) * 100) : cdf;
  
  return {
    curve: normalized,
    cdf: normalizedCDF
  };
}

function gaussianSmooth(data, sigma) {
  const result = new Array(data.length).fill(0);
  const kernelRadius = Math.ceil(sigma * 3);
  
  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    let weightSum = 0;
    
    for (let j = -kernelRadius; j <= kernelRadius; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < data.length) {
        const weight = Math.exp(-(j * j) / (2 * sigma * sigma));
        sum += data[idx] * weight;
        weightSum += weight;
      }
    }
    
    result[i] = weightSum > 0 ? sum / weightSum : 0;
  }
  
  return result;
}

function generateDefaultDistribution() {
  const curve = [];
  for (let x = 0; x <= 100; x++) {
    const z = (x - 50) / 15;
    const y = Math.exp(-0.5 * z * z) / (15 * Math.sqrt(2 * Math.PI));
    curve.push(y * 100);
  }
  
  let cumulative = 0;
  const cdf = curve.map(val => {
    cumulative += val;
    return cumulative;
  });
  const total = cdf[cdf.length - 1];
  const normalizedCDF = cdf.map(c => (c / total) * 100);
  
  return {
    curve,
    cdf: normalizedCDF
  };
}

/* =========================
   INTERACTIVE CURSOR PLUGIN
========================= */

const cursorPlugin = {
  id: 'cursorPlugin',
  afterEvent(chart, args) {
    const event = args.event;
    
    if (event.type !== 'mousemove') return;
    
    const canvasPosition = Chart.helpers.getRelativePosition(event, chart);
    const dataX = chart.scales.x.getValueForPixel(canvasPosition.x);
    
    if (dataX === undefined || dataX < 0 || dataX > 100) {
      chart.cursorX = null;
      chart.draw();
      return;
    }
    
    chart.cursorX = dataX;
    chart.draw();
  },
  
  afterDraw(chart) {
    if (!chart.cursorX && chart.cursorX !== 0) return;
    
    const ctx = chart.ctx;
    const chartArea = chart.chartArea;
    const xScale = chart.scales.x;
    
    const xPixel = xScale.getPixelForValue(chart.cursorX);
    
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(xPixel, chartArea.top);
    ctx.lineTo(xPixel, chartArea.bottom);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(61, 214, 255, 0.8)';
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.restore();
  }
};

/* =========================
   PUBLIC API
========================= */

export async function openDrillDown(categoryPath) {
  if (state.drillDown.active) return;

  state.drillDown.active = true;
  state.drillDown.category = categoryPath;

  const children = getChildren(categoryPath);
  state.drillDown.subcategory = children.length
    ? children[0].path
    : categoryPath;

  document.getElementById('detailPanel').style.display = 'none';
  deactivateView('radarView');
  
  await new Promise(resolve => setTimeout(resolve, 50));
  
  activateView('drillDownView');

  const category = state.categoryStructure.find(c => c.path === categoryPath);
  document.getElementById('drillDownTitle').textContent =
    `${category.icon} ${category.name}`;

  renderSubcategorySelector(categoryPath);
  await loadBellCurveChart();
  await loadDrillHistoryChart();
}

export function closeDrillDown() {
  if (!state.drillDown.active) return;
  
  state.drillDown.active = false;
  state.drillDown.category = null;
  state.drillDown.subcategory = null;

  deactivateView('drillDownView');
  
  setTimeout(() => {
    activateView('radarView');
  }, 50);

  destroyCharts();
  removeFloatingLabel();
}

export function updateDrillChartSettings() {
  const scale = document.getElementById('drillTimeScale').value;
  state.drillDown.settings.scale = scale;

  const labelMap = {
    daily: 'days',
    weekly: 'weeks',
    monthly: 'months',
    yearly: 'years'
  };
  
  const unitsLabel = document.getElementById('drillTimeUnitsLabel');
  if (unitsLabel) {
    unitsLabel.textContent = labelMap[scale] || '';
  }

  if (scale === 'custom') {
    document.getElementById('drillCustomDateRange').style.display = 'block';
    document.getElementById('drillTimeUnits').disabled = true;
    
    state.drillDown.settings.customStart =
      document.getElementById('drillCustomStartDate').value || null;
    state.drillDown.settings.customEnd =
      document.getElementById('drillCustomEndDate').value || null;
    state.drillDown.settings.customAggregation =
      document.getElementById('drillCustomAggregation').value || 'daily';
  } else {
    document.getElementById('drillCustomDateRange').style.display = 'none';
    document.getElementById('drillTimeUnits').disabled = false;
    state.drillDown.settings.units =
      parseInt(document.getElementById('drillTimeUnits').value) || 6;
  }
}

export async function refreshDrillChart() {
  updateDrillChartSettings();
  await loadBellCurveChart();
  await loadDrillHistoryChart();
}

/* =========================
   INTERNALS
========================= */

function destroyCharts() {
  if (state.drillDown.bellCurveChart) {
    state.drillDown.bellCurveChart.destroy();
    state.drillDown.bellCurveChart = null;
  }
  if (state.drillDown.historyChart) {
    state.drillDown.historyChart.destroy();
    state.drillDown.historyChart = null;
  }
}

function renderSubcategorySelector(categoryPath) {
  const selector = document.getElementById('subcategorySelector');
  const subs = getChildren(categoryPath);

  if (!subs.length) {
    selector.style.display = 'none';
    return;
  }

  selector.style.display = 'flex';
  selector.innerHTML = '';

  subs.forEach(sub => {
    const btn = document.createElement('button');
    btn.className = 'subcategory-button';
    btn.textContent = `${sub.icon} ${sub.name}`;

    if (sub.path === state.drillDown.subcategory) {
      btn.classList.add('active');
    }

    btn.onclick = async () => {
      state.drillDown.subcategory = sub.path;
      document.querySelectorAll('.subcategory-button')
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await loadBellCurveChart();
      await loadDrillHistoryChart();
    };

    selector.appendChild(btn);
  });
}

function removeFloatingLabel() {
  const existing = document.getElementById('bellCurveFloatingLabel');
  if (existing) existing.remove();
}

function createFloatingLabel() {
  removeFloatingLabel();
  
  const label = document.createElement('div');
  label.id = 'bellCurveFloatingLabel';
  label.style.cssText = `
    position: absolute;
    background: rgba(20, 20, 30, 0.95);
    border: 2px solid rgba(61, 214, 255, 0.8);
    border-radius: 8px;
    padding: 8px 12px;
    color: #e0e0e0;
    font-size: 13px;
    font-weight: 600;
    pointer-events: none;
    z-index: 1000;
    display: none;
    text-align: center;
    line-height: 1.4;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  `;
  
  const container = document.querySelector('.bell-curve-container');
  container.style.position = 'relative';
  container.appendChild(label);
  
  return label;
}

async function loadBellCurveChart() {
  const canvas = document.getElementById('bellCurveChart');
  if (!canvas) return;

  const { data, error } = await supabase
    .from('metric_values')
    .select('*')
    .eq('category_path', state.drillDown.subcategory)
    .not('percentile', 'is', null)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    if (state.drillDown.bellCurveChart) {
      state.drillDown.bellCurveChart.destroy();
      state.drillDown.bellCurveChart = null;
    }
    
    canvas.style.display = 'none';
    removeFloatingLabel();
    
    const parent = canvas.parentElement;
    let msg = parent.querySelector('.chart-error-msg');
    if (!msg) {
      msg = document.createElement('div');
      msg.className = 'chart-error-msg';
      msg.style.cssText = "text-align: center; padding: 40px; color: #999;";
      parent.prepend(msg);
    }
    msg.textContent = 'No data available for this subcategory';
    return;
  }

  canvas.style.display = 'block';
  const existingMsg = canvas.parentElement.querySelector('.chart-error-msg');
  if (existingMsg) existingMsg.remove();

  const latestEntry = data[0];
  
  // Use the percentile that was already calculated and stored in the database
  // (This was calculated correctly using the full metric definition in metricService.js)
  const actualLiftValue = latestEntry.value || 0;
  const currentPercentile = latestEntry.percentile || 50;
  
  // Get the actual metric name from the metric definition (e.g., "Bench Press")
  // instead of just the path segment (e.g., "strength")
  const metricDef = state.metricDefinitions.find(m => m.category_path === state.drillDown.subcategory);
  const metricName = metricDef ? metricDef.metric_name : state.drillDown.subcategory.split('.').pop();

  
  const allPercentiles = data.map(d => d.percentile);
  const useRealData = allPercentiles.length >= 5;
  
  const distribution = useRealData 
    ? generateRealDistribution(allPercentiles)
    : generateDefaultDistribution();
  
  const curveData = distribution.curve;
  const labels = Array.from({ length: 101 }, (_, i) => i);
  
  const category = state.categoryStructure.find(c => c.path === state.drillDown.subcategory);
  const floatingLabel = createFloatingLabel();

  if (state.drillDown.bellCurveChart) {
    state.drillDown.bellCurveChart.destroy();
  }

  state.drillDown.bellCurveChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: useRealData ? 'Your Performance Distribution' : 'Standard Distribution',
        data: curveData,
        borderColor: 'rgba(124, 92, 255, 0.7)',
        backgroundColor: 'rgba(124, 92, 255, 0.15)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2
      }, {
        label: 'Your Position',
        data: labels.map(x => Math.abs(x - currentPercentile) < 0.5 ? Math.max(...curveData) * 1.1 : null),
        borderColor: 'rgba(61, 214, 255, 1)',
        backgroundColor: 'rgba(61, 214, 255, 1)',
        pointRadius: labels.map(x => Math.abs(x - currentPercentile) < 0.5 ? 8 : 0),
        pointStyle: 'triangle',
        borderWidth: 0,
        showLine: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        intersect: false
      },
      onHover: (event, activeElements, chart) => {
        const canvasPosition = Chart.helpers.getRelativePosition(event, chart);
        const dataX = chart.scales.x.getValueForPixel(canvasPosition.x);
        
        if (dataX !== undefined && dataX >= 0 && dataX <= 100) {
          const percentileValue = Math.round(dataX);
          
          // Check if hovering near user's marker position
          const isNearMarker = Math.abs(percentileValue - currentPercentile) < 2;
          
          let displayValue;
          if (isNearMarker) {
            // Show user's ACTUAL lift value at their marker
            displayValue = Math.round(actualLiftValue);
          } else {
            // Show population value at this percentile
            displayValue = getActualValueFromPercentile(
              percentileValue, 
              metricName,
              state.userProfile.age,
              state.userProfile.weight
            );
          }
          
          const unit = getUnitForMetric(metricName);
          
          // Format value based on metric type
          let formattedValue;
          if (unit === '$') {
            formattedValue = '$' + displayValue.toLocaleString('en-US');
          } else {
            formattedValue = displayValue;
          }
          
          floatingLabel.innerHTML = `
            <div style="color: rgba(61, 214, 255, 1);">${percentileValue}th percentile</div>
            <div style="font-size: 12px; color: #e0e0e0; margin-top: 4px; font-weight: 700;">
              ${formattedValue}${unit !== '$' ? ' ' + unit : ''}
            </div>
          `;
          
          const rect = canvas.getBoundingClientRect();
          const container = canvas.parentElement.getBoundingClientRect();
          
          floatingLabel.style.display = 'block';
          floatingLabel.style.left = (canvasPosition.x - (floatingLabel.offsetWidth / 2)) + 'px';
          floatingLabel.style.top = (rect.height / 2 - container.top + rect.top - (floatingLabel.offsetHeight / 2)) + 'px';
        } else {
          floatingLabel.style.display = 'none';
        }
      },
      plugins: {
        title: {
          display: true,
          text: `${category?.icon || ''} ${category?.name || ''} - ${useRealData ? 'Data-Driven' : 'Standard'} Distribution`,
          color: '#e0e0e0',
          font: { size: 14, weight: '600' }
        },
        legend: {
          labels: { color: '#e0e0e0', font: { size: 11 } }
        },
        tooltip: {
          enabled: false
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Percentile',
            color: '#999'
          },
          ticks: { color: '#999' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        },
        y: {
          display: false
        }
      }
    },
    plugins: [cursorPlugin]
  });

  canvas.addEventListener('mouseleave', () => {
    floatingLabel.style.display = 'none';
  });
}

async function loadDrillHistoryChart() {
  const canvas = document.getElementById('drillHistoryChart');
  if (!canvas) return;

  const end = new Date();
  let start = new Date(end);
  
  const settings = state.drillDown.settings;
  
  if (settings.scale === 'custom') {
    start = settings.customStart ? new Date(settings.customStart) : new Date(end - 180 * 24 * 60 * 60 * 1000);
    end.setTime(settings.customEnd ? new Date(settings.customEnd).getTime() : Date.now());
  } else {
    const units = settings.units || 6;
    switch (settings.scale) {
      case 'daily':
        start.setDate(start.getDate() - units);
        break;
      case 'weekly':
        start.setDate(start.getDate() - units * 7);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - units);
        break;
      case 'yearly':
        start.setFullYear(start.getFullYear() - units);
        break;
    }
  }

  const { data } = await supabase
    .from('metric_values')
    .select('*')
    .eq('category_path', state.drillDown.subcategory)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: true });

  if (!data || !data.length) {
    canvas.classList.add('view-hidden');
    if (state.drillDown.historyChart) {
      state.drillDown.historyChart.destroy();
      state.drillDown.historyChart = null;
    }
    return;
  }

  canvas.classList.remove('view-hidden');

  const aggregationScale = settings.scale === 'custom' ?
    settings.customAggregation :
    getAggregationLevel(settings.scale);
    
  const aggregated = aggregateData(data, aggregationScale);

  const labels = [];
  const values = [];

  aggregated.forEach(e => {
    const label = formatDateLabel(e.date, aggregationScale);
    labels.push(label);
    values.push(e.percentile);
  });

  if (state.drillDown.historyChart) {
    state.drillDown.historyChart.destroy();
  }

  state.drillDown.historyChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Percentile Over Time',
        data: values,
        borderColor: 'rgba(124,92,255,0.9)',
        backgroundColor: 'rgba(124,92,255,0.1)',
        tension: 0.3,
        fill: true,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: 'rgba(232,234,242,0.95)',
        pointBorderColor: 'rgba(124,92,255,0.9)',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { 
          labels: { color: '#e0e0e0' }
        },
        title: {
          display: true,
          text: `Historical Progress (${aggregationScale} averages)`,
          color: '#e0e0e0'
        }
      },
      scales: { 
        y: { 
          min: 0, 
          max: 100,
          ticks: { color: '#999' },
          grid: { color: 'rgba(255,255,255,0.1)' },
          title: {
            display: true,
            text: 'Percentile',
            color: '#e0e0e0'
          }
        },
        x: {
          ticks: { color: '#999' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        }
      }
    }
  });
}