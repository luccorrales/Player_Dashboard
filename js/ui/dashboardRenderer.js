import { state } from '../state/state.js';
import { supabase, Chart } from '../config/supabase.js';
import { getTopLevelCategories, getChildren, buildCategoryTree } from '../services/categoryService.js';
import { loadMetricValues, calculatePercentileForMetric } from '../services/metricService.js';
import { domIdFromPath, getPercentileZone, createPercentileBand, createGoalProgress, formatDateLabel, getAggregationLevel, aggregateData } from '../utils/helpers.js';
import { loadSpiderChart, loadDashboardCharts } from './chartRenderer.js';

export async function loadDashboard() {
  await loadTopLevelStats();
  await loadSpiderChart();
  await loadDashboardCharts();
}

async function loadTopLevelStats() {
  const topCategories = getTopLevelCategories();
  
  for (const cat of topCategories) {
    const id = domIdFromPath(cat.path);
    const descendants = getAllDescendantPaths(cat.path);
    const allPaths = descendants.length > 0 ? descendants : [cat.path];
    
    const { data } = await supabase
      .from("metric_values")
      .select("*")
      .in("category_path", allPaths)
      .order("created_at", { ascending: false });
    
    if (!data || data.length === 0) continue;
    
    const grouped = {};
    data.forEach(entry => {
      const key = `${entry.category_path}_${entry.metric_name}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(entry);
    });
    
    const allPercentiles = [];
    Object.values(grouped).forEach(entries => {
      if (entries[0]?.percentile !== null && entries[0]?.percentile !== undefined) {
        allPercentiles.push(entries[0].percentile);
      }
    });
    
    if (allPercentiles.length === 0) continue;
    
    const avgPercentile = Math.round(allPercentiles.reduce((a, b) => a + b, 0) / allPercentiles.length);
    
    document.getElementById(`pct_${id}`).textContent = avgPercentile;
    
    // Percentile band
    const bandEl = document.getElementById(`band_${id}`);
    if (bandEl) {
      bandEl.innerHTML = createPercentileBand(avgPercentile);
    }
    
    // Goal progress
    const goalEl = document.getElementById(`goal_${id}`);
    if (goalEl && state.currentGoals[cat.path]) {
      goalEl.innerHTML = createGoalProgress(avgPercentile, state.currentGoals[cat.path], cat.path);
    }
    
    // Velocity
    const velocityData = calculateVelocity(data.filter(d => d.percentile !== null).reverse());
    const velocityEl = document.getElementById(`velocity_${id}`);
    if (velocityEl && velocityData) {
      velocityEl.innerHTML = createVelocityIndicator(velocityData, `${state.chartSettings.units} ${state.chartSettings.scale}`);
    }
    
    // Sparkline
    await renderSparkline(`spark_${id}`, data);
  }
  
  // Calculate overall score
  calculateOverallScore();
}

function getAllDescendantPaths(parentPath) {
  const directChildren = getChildren(parentPath);
  let paths = directChildren.map(c => c.path);
  directChildren.forEach(child => {
    paths = paths.concat(getAllDescendantPaths(child.path));
  });
  return paths;
}

function calculateVelocity(dataPoints) {
  if (dataPoints.length < 2) return null;
  
  const first = dataPoints[0];
  const last = dataPoints[dataPoints.length - 1];
  
  const change = last.percentile - first.percentile;
  const timeDiff = new Date(last.created_at) - new Date(first.created_at);
  const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
  
  return {
    change: change,
    days: daysDiff,
    ratePerMonth: (change / daysDiff) * 30
  };
}

function createVelocityIndicator(velocity, timeframe) {
  if (!velocity) return '';
  
  const { change, days, ratePerMonth } = velocity;
  const arrow = change > 0 ? '↗' : change < 0 ? '↘' : '→';
  const color = change > 0 ? 'var(--good)' : change < 0 ? 'var(--bad)' : 'var(--muted)';
  
  let timeframeText = timeframe;
  const scale = state.chartSettings.scale;
  const units = state.chartSettings.units;
  
  if (scale === 'daily') {
    timeframeText = units === 1 ? '1 day' : `${units} days`;
  } else if (scale === 'weekly') {
    timeframeText = units === 1 ? '1 week' : `${units} weeks`;
  } else if (scale === 'monthly') {
    timeframeText = units === 1 ? '1 month' : `${units} months`;
  } else if (scale === 'yearly') {
    timeframeText = units === 1 ? '1 year' : `${units} years`;
  }
  
  return `
    <div class="velocity-indicator">
      <span class="velocity-arrow" style="color: ${color};">${arrow}</span>
      <span>${change > 0 ? '+' : ''}${change.toFixed(1)} over ${timeframeText}</span>
    </div>
  `;
}

async function renderSparkline(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const percentiles = data
    .filter(d => d.percentile !== null)
    .map(d => d.percentile)
    .reverse()
    .slice(-10);
  
  if (percentiles.length < 2) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  
  if (state.sparklineCharts.has(canvasId)) {
    state.sparklineCharts.get(canvasId).destroy();
  }
  
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: percentiles.map((_, i) => i),
      datasets: [{
        data: percentiles,
        borderColor: 'rgba(124, 92, 255, 0.8)',
        borderWidth: 2,
        fill: false,
        tension: 0.3,
        pointRadius: 0
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { display: false, min: 0, max: 100 }
      }
    }
  });
  
  state.sparklineCharts.set(canvasId, chart);
}

function calculateOverallScore() {
  const topCategories = getTopLevelCategories();
  let weightedSum = 0;
  let totalWeight = 0;
  
  topCategories.forEach(cat => {
    const id = domIdFromPath(cat.path);
    const pctEl = document.getElementById(`pct_${id}`);
    const percentile = parseInt(pctEl?.textContent);
    
    if (!isNaN(percentile)) {
      const weight = state.currentWeights[cat.path] || 5;
      weightedSum += percentile * weight;
      totalWeight += weight;
    }
  });
  
  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  document.getElementById("overallScore").textContent = overallScore;
}

export function populateCategorySelectors() {
  const buttonContainer = document.getElementById("categoryButtons");
  buttonContainer.innerHTML = "";

  getTopLevelCategories().forEach((cat, idx) => {
    const id = domIdFromPath(cat.path);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "metric-card fade-in";
    card.style.animationDelay = `${Math.min(idx * 35, 280)}ms`;
    card.onclick = () => window.selectCategory(cat.path);
    card.innerHTML = `
      <div class="metric-card-top">
        <div>
          <div class="metric-title">${cat.icon} ${cat.name}</div>
          <div class="metric-subrow">
            <div class="metric-pct" id="pct_${id}">--</div>
            <div class="metric-label">percentile</div>
            <div class="metric-delta neutral" id="delta_${id}">—</div>
          </div>
        </div>
        <canvas class="sparkline" id="spark_${id}" width="96" height="32"></canvas>
      </div>
      <div id="band_${id}"></div>
      <div id="goal_${id}"></div>
      <div id="velocity_${id}"></div>
    `;
    buttonContainer.appendChild(card);
  });

  // Populate INPUT tab select
  const pathSelect = document.getElementById("categoryPathSelect");
  pathSelect.innerHTML = '<option value="">Select...</option>';

  function addInputOptions(cats, prefix = "") {
    cats.forEach(cat => {
      const hasMetrics = state.metricDefinitions.some(m => m.category_path === cat.path);
      if (hasMetrics) {
        const option = document.createElement("option");
        option.value = cat.path;
        option.textContent = prefix + (cat.icon || "") + (cat.icon ? " " : "") + cat.name;
        pathSelect.appendChild(option);
      }
      if (cat.children && cat.children.length > 0) {
        addInputOptions(cat.children, prefix + "  ");
      }
    });
  }

  addInputOptions(buildCategoryTree());

  // Populate MODAL parent select
  const parentSelect = document.getElementById("modalParentSelect");
  parentSelect.innerHTML = '<option value="">Top Level</option>';

  function addAllCategoryOptions(cats, prefix = "") {
    cats.forEach(cat => {
      const option = document.createElement("option");
      option.value = cat.path;
      option.textContent = prefix + (cat.icon || "") + (cat.icon ? " " : "") + cat.name;
      parentSelect.appendChild(option);
      if (cat.children && cat.children.length > 0) {
        addAllCategoryOptions(cat.children, prefix + "  ");
      }
    });
  }

  addAllCategoryOptions(buildCategoryTree());
}
