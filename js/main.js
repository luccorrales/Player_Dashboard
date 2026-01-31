import { percentileFunctions } from './percentile/index.js';
import { percentileFunctionsConfig } from './percentile/percentile-functions-config.js';

const SUPABASE_URL = "https://sugekxazhhxmbzncqxyg.supabase.co";
const SUPABASE_KEY = "sb_publishable_84h5tEu4ALMHkJWBxQeYdw_WqSSJiKd";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const Chart = window.Chart;

let categoryStructure = [];
let spiderChart, detailChart;
let currentWeights = {};
let currentGoals = {}; // NEW: Store goal percentiles
let selectedCategory = null;
let userProfile = {};
let metricDefinitions = [];
let chartSettings = {
  scale: 'monthly',
  units: 6,
  customStart: null,
  customEnd: null,
  customAggregation: 'daily'
};

let expandedCategories = new Set();
let editingEntries = new Set();
let sparklineCharts = new Map();

// Drill-down state
let drillDownActive = false;
let drillDownCategory = null;
let drillDownSubcategory = null;
let bellCurveChart = null;
let drillHistoryChart = null;
let drillChartSettings = {
  scale: 'monthly',
  units: 6,
  customStart: null,
  customEnd: null,
  customAggregation: 'daily'
};

function domIdFromPath(path) {
  return path.replaceAll('.', '__');
}

// INITIALIZE
async function init() {
  document.getElementById("status").textContent = "✅ Connected to Supabase";
  await loadPersonalInfo();
  const categoriesLoaded = await loadCategoryStructure(false);

  if (categoriesLoaded) {
    await loadMetricDefinitions();
    populateCategorySelectors();
    populateDataHistoryFilters();
    await loadWeights();
    await loadGoals(); // NEW: Load goals
    await loadDashboard();
    document.getElementById("status").textContent = "✅ Dashboard initialized and connected!";
  } else {
    document.getElementById("status").textContent = "❌ Critical: Failed to load categories and defaults.";
  }
}

// LOAD PERSONAL INFO
async function loadPersonalInfo() {
  const { data } = await supabase
    .from("user_profile")
    .select("*")
    .single();

  if (data) {
    userProfile = data;
    document.getElementById("userAge").value = data.age || "";
    document.getElementById("userGender").value = data.gender || "";
    document.getElementById("userWeight").value = data.weight || "";
    document.getElementById("userLocation").value = data.location || "";
  }
}

// SAVE PERSONAL INFO
async function savePersonalInfo() {
  const age = parseInt(document.getElementById("userAge").value);
  const gender = document.getElementById("userGender").value;
  const weight = parseFloat(document.getElementById("userWeight").value);
  const location = document.getElementById("userLocation").value;

  const { error } = await supabase
    .from("user_profile")
    .upsert({
      id: 1,
      age,
      gender,
      weight,
      location,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error(error);
    alert("Failed to save personal info");
    return;
  }

  userProfile = { age, gender, weight, location };
  document.getElementById("status").textContent = "✅ Personal info saved!";
}

function switchTab(tabName) {
  document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tabName).classList.add('active');
  if (typeof event !== 'undefined' && event?.target) {
    event.target.classList.add('active');
  }

  if (tabName === 'manage') {
    renderCategoryHierarchy();
  } else if (tabName === 'datahistory') {
    loadDataHistory();
  } else if (tabName === 'goals') {
    renderGoalsForm(); // NEW: Render goals form
  }
}

// LOAD CATEGORY STRUCTURE
async function loadCategoryStructure(doPopulate = true) {
  const { data, error } = await supabase
    .from("category_structure")
    .select("*")
    .order("path", { ascending: true });

  if (error || !data || data.length === 0) {
    await initializeDefaultStructure();
    const { data: newData } = await supabase
      .from("category_structure")
      .select("*")
      .order("path", { ascending: true });

    if (!newData || newData.length === 0) return false;
    categoryStructure = newData;
    populateCategorySelectors();
    return true;
  }

  categoryStructure = data;
  if (doPopulate) {
    populateCategorySelectors();
  }
  return true;
}

// LOAD METRIC DEFINITIONS
async function loadMetricDefinitions() {
  const { data } = await supabase
    .from("metric_definitions")
    .select("*");

  if (data) {
    metricDefinitions = data;
  }
}

// INITIALIZE DEFAULT STRUCTURE
async function initializeDefaultStructure() {
  const defaults = [
    { path: "physical", name: "Physical", icon: "💪", parent_path: null },
    { path: "physical.strength", name: "Strength", icon: "🏋️", parent_path: "physical" },
    { path: "cognitive", name: "Cognitive", icon: "🧠", parent_path: null },
    { path: "social", name: "Social", icon: "🗣️", parent_path: null },
    { path: "financial", name: "Financial", icon: "💰", parent_path: null },
    { path: "financial.networth", name: "Net Worth", icon: "💎", parent_path: "financial" },
    { path: "emotional", name: "Emotional", icon: "😌", parent_path: null }
  ];

  await supabase.from("category_structure").insert(defaults);

  const defaultMetrics = [
    { category_path: "financial.networth", metric_name: "Net Worth", unit: "USD", percentile_function: "networth_percentile", parameters: ["value", "age"] },
    { category_path: "physical.strength", metric_name: "Bench Press", unit: "lbs", percentile_function: "bench_press_percentile", parameters: ["weight", "age", "bodyweight"] }
  ];

  await supabase.from("metric_definitions").insert(defaultMetrics);
}

function getTopLevelCategories() {
  return categoryStructure.filter(c => !c.parent_path);
}

function getChildren(path) {
  return categoryStructure.filter(c => c.parent_path === path);
}

function buildCategoryTree(parentPath = null, level = 0) {
  const categories = parentPath === null ? getTopLevelCategories() : getChildren(parentPath);
  return categories.map(cat => ({
    ...cat,
    level,
    children: buildCategoryTree(cat.path, level + 1)
  }));
}

// NEW: Helper function to get percentile zone
function getPercentileZone(percentile) {
  if (percentile < 26) return { name: "Needs Work", class: "needs-work", color: "var(--zone-needs-work)" };
  if (percentile < 51) return { name: "Below Average", class: "below-avg", color: "var(--zone-below-avg)" };
  if (percentile < 76) return { name: "Above Average", class: "above-avg", color: "var(--zone-above-avg)" };
  if (percentile < 91) return { name: "Strong", class: "strong", color: "var(--zone-strong)" };
  return { name: "Elite", class: "elite", color: "var(--zone-elite)" };
}

// NEW: Create percentile band visualization
function createPercentileBand(percentile) {
  const zone = getPercentileZone(percentile);
  return `
    <div class="percentile-band-container">
      <div class="percentile-band">
        <div class="percentile-marker" style="left: ${percentile}%;"></div>
      </div>
      <div class="percentile-zone-label">${zone.name}</div>
    </div>
  `;
}

// NEW: Create goal progress visualization
function createGoalProgress(current, target, categoryPath) {
  if (!target || target === 0) return '';
  
  const gap = target - current;
  const progress = Math.min((current / target) * 100, 100);
  
  let statusClass = 'on-track';
  if (current < target * 0.7) statusClass = 'far-behind';
  else if (current < target * 0.85) statusClass = 'behind';
  
  return `
    <div class="goal-progress-container">
      <div class="goal-progress-header">
        <span class="goal-progress-label">🎯 Goal Progress</span>
        <span class="goal-progress-values">${Math.round(current)} / ${Math.round(target)}</span>
      </div>
      <div class="goal-progress-bar">
        <div class="goal-progress-fill ${statusClass}" style="width: ${progress}%"></div>
      </div>
      <div class="goal-gap">${gap > 0 ? `${Math.round(gap)} points to goal` : '🎉 Goal achieved!'}</div>
    </div>
  `;
}

// NEW: Calculate velocity over the selected timeframe
function calculateVelocity(dataPoints) {
  if (dataPoints.length < 2) return null;
  
  // Get first and last data points
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

// NEW: Create velocity indicator
function createVelocityIndicator(velocity, timeframe) {
  if (!velocity) return '';
  
  const { change, days, ratePerMonth } = velocity;
  const arrow = change > 0 ? '↗' : change < 0 ? '↘' : '→';
  const color = change > 0 ? 'var(--good)' : change < 0 ? 'var(--bad)' : 'var(--muted)';
  
  // Format timeframe based on chartSettings
  let timeframeText = timeframe;
  const scale = chartSettings.scale;
  const units = chartSettings.units;
  
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

function populateCategorySelectors() {
  const buttonContainer = document.getElementById("categoryButtons");
  buttonContainer.innerHTML = "";

  getTopLevelCategories().forEach((cat, idx) => {
    const id = domIdFromPath(cat.path);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "metric-card fade-in";
    card.style.animationDelay = `${Math.min(idx * 35, 280)}ms`;
    card.onclick = () => selectCategory(cat.path);
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
      const hasMetrics = metricDefinitions.some(m => m.category_path === cat.path);
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

// UPDATE METRIC INPUTS
async function updateMetricInputs() {
  const categoryPath = document.getElementById("categoryPathSelect").value;
  const container = document.getElementById("metricInputsContainer");
  container.innerHTML = "";

  if (!categoryPath) return;

  const cat = categoryStructure.find(c => c.path === categoryPath);
  document.getElementById("inputBreadcrumb").textContent = `${cat.icon} ${cat.name}`;

  const metrics = metricDefinitions.filter(m => m.category_path === categoryPath);

  if (metrics.length === 0) {
    container.innerHTML = "<p style='color: #999;'>No metrics defined for this category. Add metrics in Manage Categories.</p>";
    return;
  }

  metrics.forEach(metric => {
    const div = document.createElement("div");
    div.className = "metric-input-group";
    div.innerHTML = `
      <div class="metric-label">
        <label>${metric.metric_name} (${metric.unit})</label>
        <span class="calculated-percentile" id="percentile_${metric.id}" style="display: none;"></span>
      </div>
      <input type="number" step="any" id="metric_${metric.id}"
             placeholder="Enter ${metric.metric_name.toLowerCase()}"
             oninput="calculatePercentileForMetric(${metric.id})">
    `;
    container.appendChild(div);
  });
}

// CALCULATE PERCENTILE FOR METRIC
function calculatePercentileForMetric(metricId) {
  const metric = metricDefinitions.find(m => m.id === metricId);
  if (!metric || !metric.percentile_function) return;

  const value = parseFloat(document.getElementById(`metric_${metricId}`).value);
  if (isNaN(value)) return;

  const funcName = metric.percentile_function;
  const func = percentileFunctions[funcName];

  if (!func) return;

  const params = [value];
  if (metric.parameters && Array.isArray(metric.parameters)) {
    metric.parameters.forEach(param => {
      if (param === 'age' && userProfile.age) params.push(userProfile.age);
      if (param === 'gender' && userProfile.gender) params.push(userProfile.gender);
      if (param === 'bodyweight') {
        const bwMetric = metricDefinitions.find(m =>
          m.category_path.includes('physical') && m.metric_name.toLowerCase().includes('weight')
        );
        if (bwMetric) {
          const bw = parseFloat(document.getElementById(`metric_${bwMetric.id}`)?.value);
          if (!isNaN(bw)) params.push(bw);
        }
      }
    });
  }

  try {
    const percentile = func(...params);
    const displayEl = document.getElementById(`percentile_${metricId}`);
    displayEl.textContent = `${Math.round(percentile)}th percentile`;
    displayEl.style.display = 'inline-block';
  } catch (e) {
    console.error("Error calculating percentile:", e);
  }
}

// ADD METRIC VALUES
async function addMetricValues() {
  const categoryPath = document.getElementById("categoryPathSelect").value;
  const comparisonGroup = document.getElementById("comparisonGroup").value;

  if (!categoryPath) {
    alert("Please select a category");
    return;
  }

  const metrics = metricDefinitions.filter(m => m.category_path === categoryPath);
  const entries = [];

  for (const metric of metrics) {
    const value = parseFloat(document.getElementById(`metric_${metric.id}`).value);
    if (isNaN(value)) continue;

    let percentile = null;

    if (metric.percentile_function && percentileFunctions[metric.percentile_function]) {
      const func = percentileFunctions[metric.percentile_function];
      const params = [value];

      if (metric.parameters && Array.isArray(metric.parameters)) {
        metric.parameters.forEach(param => {
          if (param === 'age' && userProfile.age) params.push(userProfile.age);
          if (param === 'gender' && userProfile.gender) params.push(userProfile.gender);
          if (param === 'bodyweight') {
            const bwMetric = metricDefinitions.find(m =>
              m.category_path.includes('physical') && m.metric_name.toLowerCase().includes('weight')
            );
            if (bwMetric) {
              const bw = parseFloat(document.getElementById(`metric_${bwMetric.id}`)?.value);
              if (!isNaN(bw)) params.push(bw);
            }
          }
        });
      }

      try {
        percentile = Math.round(func(...params));
      } catch (e) {
        console.error("Percentile calculation error:", e);
      }
    }

    entries.push({
      category_path: categoryPath,
      metric_id: metric.id,
      metric_name: metric.metric_name,
      value,
      percentile,
      comparison_group: comparisonGroup
    });
  }

  if (entries.length === 0) {
    alert("Please enter at least one metric value");
    return;
  }

  const { error } = await supabase.from("metric_values").insert(entries);

  if (error) {
    console.error(error);
    document.getElementById("status").textContent = "❌ Insert failed";
    return;
  }

  document.getElementById("status").textContent = "✅ Values added!";

  metrics.forEach(m => {
    const input = document.getElementById(`metric_${m.id}`);
    if (input) input.value = "";
    const percentileEl = document.getElementById(`percentile_${m.id}`);
    if (percentileEl) percentileEl.style.display = 'none';
  });

  await loadDashboard();
  if (selectedCategory) {
    await loadDetailStats(selectedCategory);
  }
}

// SELECT CATEGORY
async function selectCategory(path) {
  // Check if clicking same category - toggle drill-down
  if (drillDownActive && drillDownCategory === path) {
    closeDrillDown();
    return;
  }

  // If different category while drill-down is active, update drill-down
  if (drillDownActive) {
    await openDrillDown(path);
    return;
  }

  // Otherwise open drill-down
  await openDrillDown(path);
}

// LOAD DETAIL STATS
async function loadDetailStats(path) {
  const descendants = getDescendants(path);
  const allPaths = [path, ...descendants.map(d => d.path)];

  const { data, error } = await supabase
    .from("metric_values")
    .select("*")
    .in("category_path", allPaths)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const statsGrid = document.getElementById("detailStats");
  statsGrid.innerHTML = "";

  const grouped = {};
  data.forEach(entry => {
    if (!grouped[entry.category_path]) {
      grouped[entry.category_path] = {};
    }
    if (!grouped[entry.category_path][entry.metric_name]) {
      grouped[entry.category_path][entry.metric_name] = [];
    }
    grouped[entry.category_path][entry.metric_name].push(entry);
  });

  const children = getChildren(path);
  children.forEach(child => {
    const childData = grouped[child.path];
    const childGoal = currentGoals[child.path];

    if (childData) {
      Object.keys(childData).forEach(metricName => {
        const latest = childData[metricName][0];
        const statItem = document.createElement("div");
        statItem.className = "stat-item";
        if (childGoal) statItem.classList.add('has-goal');
        statItem.style.cursor = "pointer";
        statItem.onclick = () => selectCategory(child.path);
        statItem.innerHTML = `
          <h4>${child.icon} ${child.name} - ${metricName}</h4>
          <div class="stat-value">${latest.value}</div>
          <div class="stat-percentile">${latest.percentile ? latest.percentile + 'th percentile' : 'No percentile'}</div>
          ${childGoal ? `<div style="font-size: 0.85em; color: #999; margin-top: 8px;">🎯 Goal: ${childGoal}th</div>` : ''}
        `;
        statsGrid.appendChild(statItem);
      });
    } else {
      const grandchildren = getChildren(child.path);
      const grandchildrenPaths = grandchildren.map(gc => gc.path);

      const grandchildrenData = [];
      grandchildrenPaths.forEach(gcPath => {
        if (grouped[gcPath]) {
          Object.values(grouped[gcPath]).forEach(metricArray => {
            grandchildrenData.push(...metricArray);
          });
        }
      });

      if (grandchildrenData.length > 0) {
        const latestByMetric = {};
        grandchildrenData.forEach(entry => {
          const key = `${entry.category_path}_${entry.metric_name}`;
          if (!latestByMetric[key] || new Date(entry.created_at) > new Date(latestByMetric[key].created_at)) {
            latestByMetric[key] = entry;
          }
        });

        const percentiles = Object.values(latestByMetric)
          .map(e => e.percentile)
          .filter(p => p !== null && p !== undefined);

        if (percentiles.length > 0) {
          const avgPercentile = Math.round(percentiles.reduce((a, b) => a + b, 0) / percentiles.length);
          const statItem = document.createElement("div");
          statItem.className = "stat-item";
          if (childGoal) statItem.classList.add('has-goal');
          statItem.style.cursor = "pointer";
          statItem.onclick = () => selectCategory(child.path);
          statItem.innerHTML = `
            <h4>${child.icon} ${child.name}</h4>
            <div class="stat-value">Aggregated</div>
            <div class="stat-percentile">${avgPercentile}th percentile (avg of ${percentiles.length} metrics)</div>
            <div style="font-size: 0.8em; color: #999; margin-top: 5px;">
              ${grandchildren.length} subcategories
            </div>
            ${childGoal ? `<div style="font-size: 0.85em; color: #999; margin-top: 8px;">🎯 Goal: ${childGoal}th</div>` : ''}
          `;
          statsGrid.appendChild(statItem);
        }
      }
    }
  });

  if (children.length === 0 && grouped[path]) {
    Object.keys(grouped[path]).forEach(metricName => {
      const latest = grouped[path][metricName][0];
      const statItem = document.createElement("div");
      statItem.className = "stat-item";
      statItem.innerHTML = `
        <h4>${metricName}</h4>
        <div class="stat-value">${latest.value}</div>
        <div class="stat-percentile">${latest.percentile ? latest.percentile + 'th percentile' : 'No percentile'}</div>
        <div style="font-size: 0.8em; color: #999; margin-top: 10px;">
          ${new Date(latest.created_at).toLocaleDateString()}
        </div>
      `;
      statsGrid.appendChild(statItem);
    });
  }

  await loadDetailChart(path);
}

function getDescendants(path) {
  const direct = getChildren(path);
  let all = [...direct];
  direct.forEach(child => {
    all = all.concat(getDescendants(child.path));
  });
  return all;
}

// LOAD DETAIL CHART (with goal line)
async function loadDetailChart(path) {
  function getAllDescendantPaths(parentPath) {
    const directChildren = getChildren(parentPath);
    let paths = directChildren.map(c => c.path);
    directChildren.forEach(child => {
      paths = paths.concat(getAllDescendantPaths(child.path));
    });
    return paths;
  }

  const descendantPaths = getAllDescendantPaths(path);
  const allPaths = descendantPaths.length > 0 ? descendantPaths : [path];

  const endDate = new Date();
  let startDate = new Date();

  if (chartSettings.scale === 'custom') {
    startDate = chartSettings.customStart ? new Date(chartSettings.customStart) : new Date(endDate - 180 * 24 * 60 * 60 * 1000);
    endDate.setTime(chartSettings.customEnd ? new Date(chartSettings.customEnd).getTime() : Date.now());
  } else {
    const units = chartSettings.units || 6;
    switch (chartSettings.scale) {
      case 'daily':
        startDate.setDate(startDate.getDate() - units);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - units * 7);
        break;
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - units);
        break;
      case 'yearly':
        startDate.setFullYear(startDate.getFullYear() - units);
        break;
    }
  }

  const { data, error } = await supabase
    .from("metric_values")
    .select("*")
    .in("category_path", allPaths)
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString())
    .order("created_at", { ascending: true });

  if (error) return;

  const ctx = document.getElementById("detailChart");
  if (detailChart) detailChart.destroy();

  const aggregationScale = chartSettings.scale === 'custom' ?
    chartSettings.customAggregation :
    getAggregationLevel(chartSettings.scale);

  const aggregatedData = aggregateData(data, aggregationScale);

  const datasets = {};
  aggregatedData.forEach(entry => {
    const key = `${entry.category_path}_${entry.metric_name}`;
    if (!datasets[key]) {
      const cat = categoryStructure.find(c => c.path === entry.category_path);
      datasets[key] = {
        label: (cat ? cat.icon + " " + cat.name + " - " : "") + entry.metric_name,
        data: [],
        tension: 0.3,
        borderWidth: 2
      };
    }
  });

  const labels = [];
  aggregatedData.forEach(entry => {
    const dateLabel = formatDateLabel(entry.date, aggregationScale);
    if (!labels.includes(dateLabel)) labels.push(dateLabel);

    const key = `${entry.category_path}_${entry.metric_name}`;
    if (datasets[key] && entry.percentile !== null) {
      datasets[key].data.push({
        x: dateLabel,
        y: entry.percentile
      });
    }
  });

  // NEW: Add goal line if exists
  const goalValue = currentGoals[path];
  const chartDatasets = Object.values(datasets);
  
  if (goalValue && labels.length > 0) {
    chartDatasets.push({
      label: '🎯 Goal Target',
      data: labels.map(label => ({ x: label, y: goalValue })),
      borderColor: 'rgba(124, 92, 255, 0.7)',
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      fill: false,
      tension: 0
    });
  }

  detailChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: chartDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `Historical Progress (${aggregationScale} averages)`,
          color: '#e0e0e0'
        },
        legend: {
          labels: { color: '#e0e0e0' }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          title: { display: true, text: "Percentile", color: '#e0e0e0' },
          ticks: { color: '#e0e0e0' },
          grid: { color: '#3a3a4e' }
        },
        x: {
          ticks: { color: '#e0e0e0' },
          grid: { color: '#3a3a4e' }
        }
      }
    }
  });
}

function getAggregationLevel(scale) {
  const levels = ['hourly', 'daily', 'weekly', 'monthly', 'yearly'];
  const currentIndex = levels.indexOf(scale);
  return currentIndex > 0 ? levels[currentIndex - 1] : 'hourly';
}

function aggregateData(rawData, aggregationScale) {
  const grouped = {};

  rawData.forEach(entry => {
    const date = new Date(entry.created_at);
    let periodKey;

    switch (aggregationScale) {
      case 'hourly': {
        const hour = String(date.getHours()).padStart(2, '0');
        periodKey = `${date.toISOString().split('T')[0]} ${hour}:00`;
        break;
      }
      case 'daily':
        periodKey = date.toISOString().split('T')[0];
        break;
      case 'weekly': {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        periodKey = weekStart.toISOString().split('T')[0];
        break;
      }
      case 'monthly':
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'yearly':
        periodKey = `${date.getFullYear()}`;
        break;
      default:
        periodKey = date.toISOString().split('T')[0];
    }

    const key = `${entry.category_path}_${entry.metric_name}_${periodKey}`;

    if (!grouped[key]) {
      grouped[key] = {
        category_path: entry.category_path,
        metric_name: entry.metric_name,
        date: periodKey,
        percentiles: [],
        values: []
      };
    }

    if (entry.percentile !== null) {
      grouped[key].percentiles.push(entry.percentile);
    }
    if (entry.value !== null) {
      grouped[key].values.push(entry.value);
    }
  });

  return Object.values(grouped).map(group => ({
    category_path: group.category_path,
    metric_name: group.metric_name,
    date: group.date,
    percentile: group.percentiles.length > 0 ?
      group.percentiles.reduce((a, b) => a + b) / group.percentiles.length : null,
    value: group.values.length > 0 ?
      group.values.reduce((a, b) => a + b) / group.values.length : null
  }));
}

function formatDateLabel(dateStr, aggregationScale) {
  const date = new Date(dateStr);

  switch (aggregationScale) {
    case 'hourly':
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    case 'daily':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case 'weekly':
      return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    case 'monthly':
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    case 'yearly':
      return date.getFullYear().toString();
    default:
      return date.toLocaleDateString();
  }
}

function updateChartSettings() {
  const scale = document.getElementById("timeScale").value;
  const units = document.getElementById("timeUnits").value;

  chartSettings.scale = scale;
  chartSettings.units = parseInt(units);

  const labelMap = {
    daily: 'days',
    weekly: 'weeks',
    monthly: 'months',
    yearly: 'years'
  };
  document.getElementById("timeUnitsLabel").textContent = labelMap[scale] || '';

  const customRange = document.getElementById("customDateRange");
  if (scale === 'custom') {
    customRange.style.display = 'block';
    document.getElementById("timeUnits").disabled = true;

    if (!document.getElementById("customEndDate").value) {
      document.getElementById("customEndDate").value = new Date().toISOString().split('T')[0];
    }
    if (!document.getElementById("customStartDate").value) {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      document.getElementById("customStartDate").value = sixMonthsAgo.toISOString().split('T')[0];
    }

    chartSettings.customStart = document.getElementById("customStartDate").value;
    chartSettings.customEnd = document.getElementById("customEndDate").value;
    chartSettings.customAggregation = document.getElementById("customAggregation").value;
  } else {
    customRange.style.display = 'none';
    document.getElementById("timeUnits").disabled = false;
  }
}

function refreshChart() {
  if (chartSettings.scale === 'custom') {
    chartSettings.customStart = document.getElementById("customStartDate").value;
    chartSettings.customEnd = document.getElementById("customEndDate").value;
    chartSettings.customAggregation = document.getElementById("customAggregation").value;
  }

  // Refresh the dashboard to update velocity indicators
  loadDashboard();
  
  if (selectedCategory) {
    loadDetailChart(selectedCategory);
  }
}

// LOAD SPIDER CHART (with goal overlays and enhanced velocity)
async function loadDashboard() {
  const topLevel = getTopLevelCategories();
  const categoryAverages = {};
  const categoryDeltas = {};
  const categorySpark = {};
  const categoryVelocities = {}; // NEW: Store velocity data

  for (const cat of topLevel) {
    const descendants = getDescendants(cat.path);
    const allPaths = [cat.path, ...descendants.map(d => d.path)];

    // NEW: Calculate date range based on current chartSettings
    const endDate = new Date();
    let startDate = new Date();
    
    if (chartSettings.scale === 'custom') {
      startDate = chartSettings.customStart ? new Date(chartSettings.customStart) : new Date(endDate - 180 * 24 * 60 * 60 * 1000);
    } else {
      const units = chartSettings.units || 6;
      switch (chartSettings.scale) {
        case 'daily':
          startDate.setDate(startDate.getDate() - units);
          break;
        case 'weekly':
          startDate.setDate(startDate.getDate() - units * 7);
          break;
        case 'monthly':
          startDate.setMonth(startDate.getMonth() - units);
          break;
        case 'yearly':
          startDate.setFullYear(startDate.getFullYear() - units);
          break;
      }
    }

    const { data } = await supabase
      .from("metric_values")
      .select("percentile, metric_name, category_path, created_at")
      .in("category_path", allPaths)
      .not("percentile", "is", null)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(80);

    if (!data || data.length === 0) {
      categoryAverages[cat.path] = 0;
      categoryDeltas[cat.path] = null;
      categorySpark[cat.path] = [];
      categoryVelocities[cat.path] = null;
      continue;
    }

    // Calculate latest and previous averages
    const latestByMetric = new Map();
    const prevByMetric = new Map();
    const series = [];

    for (const row of data) {
      series.push(row.percentile);
      const key = `${row.category_path}__${row.metric_name}`;
      if (!latestByMetric.has(key)) {
        latestByMetric.set(key, row.percentile);
      } else if (!prevByMetric.has(key)) {
        prevByMetric.set(key, row.percentile);
      }
    }

    const latestVals = Array.from(latestByMetric.values()).filter(v => v !== null && v !== undefined);
    const prevVals = Array.from(prevByMetric.values()).filter(v => v !== null && v !== undefined);

    const latestAvg = latestVals.length ? (latestVals.reduce((a, b) => a + b, 0) / latestVals.length) : 0;
    const prevAvg = prevVals.length ? (prevVals.reduce((a, b) => a + b, 0) / prevVals.length) : null;

    categoryAverages[cat.path] = latestAvg;
    categoryDeltas[cat.path] = prevAvg === null ? null : (latestAvg - prevAvg);
    categorySpark[cat.path] = series.slice(0, 14).reverse();
    
    // NEW: Calculate velocity based on timeframe (all data in range, sorted ascending)
    const timeframeData = [...data].reverse(); // Reverse to get ascending order
    categoryVelocities[cat.path] = calculateVelocity(timeframeData);
  }

  const ctx = document.getElementById("spiderChart");
  if (spiderChart) spiderChart.destroy();

  const radarGradient = (() => {
    const c = ctx.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, 320);
    g.addColorStop(0, 'rgba(124, 92, 255, 0.30)');
    g.addColorStop(1, 'rgba(61, 214, 255, 0.10)');
    return g;
  })();

  spiderChart = new Chart(ctx, {
    type: "radar",
    data: {
      labels: topLevel.map(c => c.icon + " " + c.name),
      datasets: [{
        label: "Current Percentiles",
        data: topLevel.map(c => categoryAverages[c.path] || 0),
        backgroundColor: radarGradient,
        borderColor: "rgba(124, 92, 255, 0.75)",
        borderWidth: 1.5,
        pointBackgroundColor: "rgba(232, 234, 242, 0.95)",
        pointBorderColor: "rgba(124, 92, 255, 0.9)",
        pointBorderWidth: 2,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: 'rgba(232,234,242,0.78)' }
        }
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 20,
            color: 'rgba(232,234,242,0.55)',
            backdropColor: 'transparent'
          },
          grid: { color: 'rgba(255,255,255,0.10)' },
          angleLines: { color: 'rgba(255,255,255,0.10)' },
          pointLabels: { color: 'rgba(232,234,242,0.80)', font: { size: 12, weight: '600' } }
        }
      }
    }
  });

  let totalWeighted = 0;
  let totalWeight = 0;

  topLevel.forEach(cat => {
    const weight = currentWeights[cat.path] || 5;
    totalWeighted += (categoryAverages[cat.path] || 0) * weight;
    totalWeight += weight;
  });

  const overallScore = totalWeight > 0 ? Math.round(totalWeighted / totalWeight) : 0;
  document.getElementById("overallScore").textContent = overallScore;

  // Update cards + sparklines + visualizations
  for (const cat of topLevel) {
    const id = domIdFromPath(cat.path);
    const pctEl = document.getElementById(`pct_${id}`);
    const deltaEl = document.getElementById(`delta_${id}`);
    const sparkCanvas = document.getElementById(`spark_${id}`);
    const bandEl = document.getElementById(`band_${id}`);
    const goalEl = document.getElementById(`goal_${id}`);
    const velocityEl = document.getElementById(`velocity_${id}`);

    const currentPct = Math.round(categoryAverages[cat.path] || 0);
    if (pctEl) pctEl.textContent = currentPct;

    const delta = categoryDeltas[cat.path];
    if (deltaEl) {
      deltaEl.classList.remove('good', 'bad', 'neutral');
      if (delta === null || Number.isNaN(delta)) {
        deltaEl.classList.add('neutral');
        deltaEl.textContent = '—';
      } else {
        const d = Math.round(delta);
        if (d > 0) deltaEl.classList.add('good');
        else if (d < 0) deltaEl.classList.add('bad');
        else deltaEl.classList.add('neutral');
        deltaEl.textContent = `${d > 0 ? '+' : ''}${d}`;
      }
    }

    if (bandEl && currentPct > 0) {
      bandEl.innerHTML = createPercentileBand(currentPct);
    }

    if (goalEl) {
      const goalTarget = currentGoals[cat.path];
      if (goalTarget) {
        goalEl.innerHTML = createGoalProgress(currentPct, goalTarget, cat.path);
      }
    }

    if (velocityEl) {
      const velocity = categoryVelocities[cat.path];
      if (velocity) {
        velocityEl.innerHTML = createVelocityIndicator(velocity);
      }
    }

    if (sparkCanvas) {
      const series = categorySpark[cat.path] || [];
      const existing = sparklineCharts.get(cat.path);
      if (existing) existing.destroy();

      sparklineCharts.set(cat.path, new Chart(sparkCanvas, {
        type: 'line',
        data: {
          labels: series.map((_, i) => i),
          datasets: [{
            data: series,
            borderColor: 'rgba(61, 214, 255, 0.9)',
            backgroundColor: 'rgba(61, 214, 255, 0.10)',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
            fill: true
          }]
        },
        options: {
          responsive: false,
          animation: { duration: 300 },
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } }
        }
      }));
    }
  }

  // Load analytics charts
  await loadAnalyticsCharts(topLevel, categoryAverages);
}

// ==================== ANALYTICS CHARTS ====================

let pieChart, barChart;

async function loadAnalyticsCharts(topLevel, categoryAverages) {
  // Pie Chart - Category Distribution
  const pieCtx = document.getElementById("pieChart");
  if (pieChart) pieChart.destroy();

  const pieData = topLevel.map(cat => categoryAverages[cat.path] || 0);
  const pieLabels = topLevel.map(cat => cat.icon + " " + cat.name);
  
  const pieColors = [
    'rgba(124, 92, 255, 0.8)',
    'rgba(61, 214, 255, 0.8)',
    'rgba(52, 211, 153, 0.8)',
    'rgba(251, 113, 133, 0.8)',
    'rgba(234, 179, 8, 0.8)',
    'rgba(168, 85, 247, 0.8)',
    'rgba(249, 115, 22, 0.8)'
  ];

  pieChart = new Chart(pieCtx, {
    type: 'doughnut',
    data: {
      labels: pieLabels,
      datasets: [{
        data: pieData,
        backgroundColor: pieColors,
        borderColor: 'rgba(10, 15, 31, 0.8)',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: 'rgba(232,234,242,0.80)',
            padding: 12,
            font: { size: 12 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.label + ': ' + Math.round(context.parsed) + 'th percentile';
            }
          }
        }
      }
    }
  });

  // Bar Chart - Performance Comparison
  const barCtx = document.getElementById("barChart");
  if (barChart) barChart.destroy();

  const barData = topLevel.map(cat => {
    const current = categoryAverages[cat.path] || 0;
    const goal = currentGoals[cat.path] || 100;
    return { current, goal };
  });

  barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: pieLabels,
      datasets: [
        {
          label: 'Current',
          data: barData.map(d => d.current),
          backgroundColor: 'rgba(61, 214, 255, 0.7)',
          borderColor: 'rgba(61, 214, 255, 1)',
          borderWidth: 1
        },
        {
          label: 'Goal',
          data: barData.map(d => d.goal),
          backgroundColor: 'rgba(124, 92, 255, 0.3)',
          borderColor: 'rgba(124, 92, 255, 0.6)',
          borderWidth: 1,
          borderDash: [5, 5]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: 'rgba(232,234,242,0.80)',
            font: { size: 12 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + Math.round(context.parsed.y) + 'th';
            }
          }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            color: 'rgba(232,234,242,0.70)',
            callback: function(value) {
              return value + 'th';
            }
          },
          grid: { color: 'rgba(255,255,255,0.08)' }
        },
        x: {
          ticks: { 
            color: 'rgba(232,234,242,0.70)',
            font: { size: 11 }
          },
          grid: { display: false }
        }
      }
    }
  });
}

// ==================== END ANALYTICS CHARTS ====================

// ==================== GOALS MANAGEMENT ====================

// NEW: Load goals from database
async function loadGoals() {
  const { data } = await supabase
    .from("category_goals")
    .select("*")
    .single();

  if (data) {
    currentGoals = data.goals || {};
  }
}

// NEW: Render goals form
function renderGoalsForm() {
  const form = document.getElementById("goalsForm");
  if (!form) return;
  
  form.innerHTML = "";

  getTopLevelCategories().forEach(cat => {
    const currentGoal = currentGoals[cat.path] || 0;
    
    const div = document.createElement("div");
    div.className = "goal-form-item";
    div.innerHTML = `
      <div class="goal-form-header">
        <span class="goal-form-title">${cat.icon} ${cat.name}</span>
      </div>
      <div class="goal-input-row">
        <div class="form-group" style="margin: 0;">
          <label>Target Percentile (0-100)</label>
          <input type="number" id="goal_${cat.path}" min="0" max="100" value="${currentGoal}" placeholder="e.g., 85">
        </div>
        <div class="form-group" style="margin: 0;">
          <label>Priority Level</label>
          <select id="priority_${cat.path}">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
    `;
    form.appendChild(div);
  });
}

// NEW: Save goals
async function saveGoals() {
  const goals = {};
  
  getTopLevelCategories().forEach(cat => {
    const goalInput = document.getElementById(`goal_${cat.path}`);
    if (goalInput && goalInput.value) {
      goals[cat.path] = parseInt(goalInput.value);
    }
  });

  console.log('Saving goals:', goals); // Debug log

  try {
    // First, try to check if row exists
    const { data: existingData, error: fetchError } = await supabase
      .from("category_goals")
      .select("*")
      .eq("id", 1)
      .single();

    console.log('Existing data:', existingData); // Debug log

    let result;
    if (existingData) {
      // Update existing row
      result = await supabase
        .from("category_goals")
        .update({ 
          goals,
          updated_at: new Date().toISOString()
        })
        .eq("id", 1)
        .select();
    } else {
      // Insert new row
      result = await supabase
        .from("category_goals")
        .insert([{ 
          id: 1, 
          goals,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select();
    }

    const { data, error } = result;

    if (error) {
      console.error('Supabase error:', error);
      alert(`Failed to save goals: ${error.message}\n\nPlease check:\n1. Table "category_goals" exists\n2. RLS policies allow INSERT/UPDATE\n3. Run setup_database.sql`);
      return;
    }

    console.log('Goals saved successfully:', data); // Debug log
    currentGoals = goals;
    document.getElementById("status").textContent = "✅ Goals saved!";
    
    // Refresh dashboard to show new goals
    await loadDashboard();
    
    // Show success feedback
    setTimeout(() => {
      document.getElementById("status").textContent = "✅ Dashboard updated with new goals!";
    }, 500);
    
  } catch (err) {
    console.error('Unexpected error:', err);
    alert(`Unexpected error: ${err.message}\n\nThis usually means the table doesn't exist. Please run setup_database.sql in Supabase.`);
  }
}

// ==================== END GOALS MANAGEMENT ====================

// MODAL FUNCTIONS
let metricFieldCounter = 0;

function openAddCategoryModal() {
  document.getElementById("modalTitle").textContent = "Add Top-Level Category";
  document.getElementById("modalEditPath").value = "";
  document.getElementById("modalParentSelect").value = "";
  document.getElementById("modalCategoryName").value = "";
  document.getElementById("modalCategoryIcon").value = "";
  document.getElementById("metricsContainer").innerHTML = "";
  metricFieldCounter = 0;
  document.getElementById("categoryModal").classList.add("active");
}

function openAddSubCategoryModal() {
  document.getElementById("modalTitle").textContent = "Add Sub-Category";
  document.getElementById("modalEditPath").value = "";
  document.getElementById("modalCategoryName").value = "";
  document.getElementById("modalCategoryIcon").value = "";
  document.getElementById("metricsContainer").innerHTML = "";
  metricFieldCounter = 0;
  document.getElementById("categoryModal").classList.add("active");
}

function openEditCategoryModal(path) {
  const category = categoryStructure.find(c => c.path === path);
  if (!category) return;

  document.getElementById("modalTitle").textContent = "Edit Category";
  document.getElementById("modalEditPath").value = path;
  document.getElementById("modalOriginalPath").value = path;
  document.getElementById("modalParentSelect").value = category.parent_path || "";
  document.getElementById("modalCategoryName").value = category.name;
  document.getElementById("modalCategoryIcon").value = category.icon || "";

  const metrics = metricDefinitions.filter(m => m.category_path === path);
  document.getElementById("metricsContainer").innerHTML = "";
  metricFieldCounter = 0;

  metrics.forEach(metric => {
    addMetricField(metric);
  });

  document.getElementById("categoryModal").classList.add("active");
}

function closeModal() {
  document.getElementById("categoryModal").classList.remove("active");
}

function addMetricField(existingMetric = null) {
  const container = document.getElementById("metricsContainer");
  const id = metricFieldCounter++;

  const div = document.createElement("div");
  div.className = "metric-input-group";
  div.id = `metricField_${id}`;

  const metricId = existingMetric ? existingMetric.id : null;

  div.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <strong>Metric ${id + 1}</strong>
      <button onclick="removeMetricField(${id})" class="danger" style="padding: 5px 10px;">Remove</button>
    </div>
    ${metricId ? `<input type="hidden" id="metricId_${id}" value="${metricId}">` : ''}
    <div class="form-group">
      <label>Metric Name</label>
      <input type="text" id="metricName_${id}" placeholder="e.g., Net Worth" value="${existingMetric?.metric_name || ''}">
    </div>
    <div class="form-group">
      <label>Unit</label>
      <input type="text" id="metricUnit_${id}" placeholder="e.g., USD, lbs, minutes" value="${existingMetric?.unit || ''}">
    </div>
    <div class="form-group">
      <label>Percentile Function (optional)</label>
      <select id="metricFunc_${id}">
        <option value="">None (manual entry)</option>
        ${getPercentileFunctionOptions(existingMetric?.percentile_function)}
      </select>
    </div>
  `;
  container.appendChild(div);
}

function getPercentileFunctionOptions(selectedFunc = null) {
  return percentileFunctionsConfig.functions.map(f =>
    `<option value="${f.value}" ${f.value === selectedFunc ? 'selected' : ''}>${f.label}</option>`
  ).join('');
}

function removeMetricField(id) {
  const field = document.getElementById(`metricField_${id}`);
  if (field) field.remove();
}

async function saveCategory() {
  const editPath = document.getElementById("modalEditPath").value;
  const isEdit = !!editPath;

  const parentPath = document.getElementById("modalParentSelect").value;
  const name = document.getElementById("modalCategoryName").value;
  const icon = document.getElementById("modalCategoryIcon").value;

  if (!name) {
    alert("Please enter a category name");
    return;
  }

  let path = editPath;

  if (!isEdit) {
    const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    path = parentPath ? `${parentPath}.${safeName}` : safeName;

    const { error: catError } = await supabase.from("category_structure").insert([{
      path,
      name,
      icon: icon || "",
      parent_path: parentPath || null
    }]);

    if (catError) {
      console.error(catError);
      alert("Failed to add category");
      return;
    }
  } else {
    const originalPath = document.getElementById("modalOriginalPath").value || editPath;
    const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newPath = parentPath ? `${parentPath}.${safeName}` : safeName;

    if (newPath !== originalPath) {
      const descendants = getDescendants(originalPath);

      const { error: updateError } = await supabase.from("category_structure").update({
        path: newPath,
        name,
        icon: icon || "",
        parent_path: parentPath || null
      }).eq("path", originalPath);

      if (updateError) {
        console.error(updateError);
        alert("Failed to update category");
        return;
      }

      for (const desc of descendants) {
        const newDescPath = desc.path.replace(originalPath, newPath);
        const newDescParent = desc.parent_path ? desc.parent_path.replace(originalPath, newPath) : desc.parent_path;
        await supabase.from("category_structure").update({
          path: newDescPath,
          parent_path: newDescParent
        }).eq("path", desc.path);

        await supabase.from("metric_definitions").update({ category_path: newDescPath }).eq("category_path", desc.path);
        await supabase.from("metric_values").update({ category_path: newDescPath }).eq("category_path", desc.path);
      }

      await supabase.from("metric_definitions").update({ category_path: newPath }).eq("category_path", originalPath);
      await supabase.from("metric_values").update({ category_path: newPath }).eq("category_path", originalPath);

      path = newPath;
    } else {
      const { error: catError } = await supabase.from("category_structure").update({ name, icon: icon || "" }).eq("path", path);
      if (catError) {
        console.error(catError);
        alert("Failed to update category");
        return;
      }
    }

    const existingMetrics = metricDefinitions.filter(m => m.category_path === path);
    const metricsToKeep = [];

    for (let i = 0; i < metricFieldCounter; i++) {
      const metricIdField = document.getElementById(`metricId_${i}`);
      if (metricIdField) {
        metricsToKeep.push(metricIdField.value);
      }
    }

    for (const metric of existingMetrics) {
      if (!metricsToKeep.includes(metric.id)) {
        await supabase.from("metric_definitions").delete().eq("id", metric.id);
      }
    }
  }

  for (let i = 0; i < metricFieldCounter; i++) {
    const nameField = document.getElementById(`metricName_${i}`);
    if (!nameField) continue;

    const metricId = document.getElementById(`metricId_${i}`)?.value;
    const metricName = nameField.value;
    const unit = document.getElementById(`metricUnit_${i}`).value;
    const func = document.getElementById(`metricFunc_${i}`).value;

    if (metricName && unit) {
      const metricData = {
        category_path: path,
        metric_name: metricName,
        unit,
        percentile_function: func || null,
        parameters: func ? getParametersForFunction(func) : null
      };

      if (metricId) {
        await supabase
          .from("metric_definitions")
          .update(metricData)
          .eq("id", metricId);
      } else {
        await supabase.from("metric_definitions").insert([metricData]);
      }
    }
  }

  closeModal();
  await loadCategoryStructure();
  await loadMetricDefinitions();
  renderCategoryHierarchy();
  document.getElementById("status").textContent = isEdit ? "✅ Category updated!" : "✅ Category added!";
}

function getParametersForFunction(funcName) {
  return percentileFunctionsConfig.parameters[funcName] || ["value"];
}

function renderCategoryHierarchy() {
  const container = document.getElementById("categoryHierarchy");
  container.innerHTML = "";

  function renderTree(cats, parentElement) {
    cats.forEach(cat => {
      const item = document.createElement("div");
      item.className = "hierarchy-item";

      const metrics = metricDefinitions.filter(m => m.category_path === cat.path);
      const metricsText = metrics.length > 0 ?
        ` (${metrics.length} metric${metrics.length > 1 ? 's' : ''})` : '';

      item.innerHTML = `
        <span>${cat.icon || ""}${cat.icon ? " " : ""}${cat.name}${metricsText}</span>
        <div>
          <button onclick="openEditCategoryModal('${cat.path}')" class="secondary" style="padding: 5px 10px; font-size: 14px;">Edit</button>
          <button onclick="deleteCategory('${cat.path}')" class="danger" style="padding: 5px 10px; font-size: 14px;">Delete</button>
        </div>
      `;
      parentElement.appendChild(item);

      if (cat.children && cat.children.length > 0) {
        const subtree = document.createElement("div");
        subtree.className = "hierarchy-tree";
        parentElement.appendChild(subtree);
        renderTree(cat.children, subtree);
      }
    });
  }

  const tree = buildCategoryTree();
  renderTree(tree, container);
}

async function deleteCategory(path) {
  if (!confirm(`Delete "${path}" and all its sub-categories and metrics?`)) return;

  const descendants = getDescendants(path);
  const allPaths = [path, ...descendants.map(d => d.path)];

  await supabase.from("category_structure").delete().in("path", allPaths);
  await supabase.from("metric_definitions").delete().in("category_path", allPaths);

  await loadCategoryStructure();
  await loadMetricDefinitions();
  renderCategoryHierarchy();
  document.getElementById("status").textContent = "✅ Category deleted!";
}

// LOAD WEIGHTS
async function loadWeights() {
  const { data } = await supabase
    .from("category_weights")
    .select("*")
    .single();

  if (data) {
    currentWeights = data.weights || {};
  }

  const form = document.getElementById("weightsForm");
  form.innerHTML = "";

  getTopLevelCategories().forEach(cat => {
    const weight = currentWeights[cat.path] || 5;
    form.innerHTML += `
      <div class="form-group">
        <label>${cat.icon} ${cat.name}</label>
        <input type="range" id="weight_${cat.path}" min="1" max="10" value="${weight}"
               oninput="document.getElementById('weight_${cat.path}_val').textContent = this.value">
        <span id="weight_${cat.path}_val" style="margin-left: 10px; font-weight: bold;">${weight}</span>
      </div>
    `;
  });
}

// SAVE WEIGHTS
async function saveWeights() {
  const weights = {};
  getTopLevelCategories().forEach(cat => {
    weights[cat.path] = parseInt(document.getElementById(`weight_${cat.path}`).value);
  });

  const { error } = await supabase
    .from("category_weights")
    .upsert({ id: 1, weights });

  if (error) {
    console.error(error);
    alert("Failed to save weights");
    return;
  }

  currentWeights = weights;
  document.getElementById("status").textContent = "✅ Weights saved!";
  await loadDashboard();
}

// ==================== DATA HISTORY MANAGEMENT FUNCTIONS ====================

function populateDataHistoryFilters() {
  const filterSelect = document.getElementById("filterCategory");
  if (!filterSelect) return;
  filterSelect.innerHTML = '<option value="">All Categories</option>';
  function addFilterOptions(cats, prefix = "") {
    cats.forEach(cat => {
      const option = document.createElement("option");
      option.value = cat.path;
      option.textContent = prefix + (cat.icon || "") + (cat.icon ? " " : "") + cat.name;
      filterSelect.appendChild(option);
      if (cat.children && cat.children.length > 0) addFilterOptions(cat.children, prefix + "  ");
    });
  }
  addFilterOptions(buildCategoryTree());
}

async function loadDataHistory() {
  const container = document.getElementById("dataHistoryTree");
  if (!container) return;
  container.innerHTML = "<p style='text-align: center; padding: 20px;'>Loading data...</p>";

  const filterCategory = document.getElementById("filterCategory").value;
  const filterStartDate = document.getElementById("filterStartDate").value;
  const filterEndDate = document.getElementById("filterEndDate").value;

  let query = supabase.from("metric_values").select("*").order("created_at", { ascending: false });

  if (filterCategory) {
    const descendants = getDescendants(filterCategory);
    const allPaths = [filterCategory, ...descendants.map(d => d.path)];
    query = query.in("category_path", allPaths);
  }

  if (filterStartDate) {
    query = query.gte("created_at", new Date(filterStartDate).toISOString());
  }

  if (filterEndDate) {
    const endDate = new Date(filterEndDate);
    endDate.setHours(23, 59, 59, 999);
    query = query.lte("created_at", endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    container.innerHTML = "<p style='text-align: center; padding: 20px; color: red;'>Error loading data</p>";
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = "<div class='no-data-message'>No data found matching your filters.</div>";
    return;
  }

  const grouped = {};
  data.forEach(entry => {
    if (!grouped[entry.category_path]) {
      grouped[entry.category_path] = [];
    }
    grouped[entry.category_path].push(entry);
  });

  container.innerHTML = "";
  const tree = buildCategoryTree();
  renderDataTree(tree, container, grouped);
}

function renderDataTree(categories, parentElement, dataGrouped) {
  categories.forEach(cat => {
    const entries = dataGrouped[cat.path] || [];
    const hasData = entries.length > 0;
    const hasChildrenWithData = cat.children && cat.children.some(child => checkHasData(child, dataGrouped));
    if (!hasData && !hasChildrenWithData) return;
    const categoryDiv = document.createElement("div");
    categoryDiv.className = "tree-category";
    const header = document.createElement("div");
    header.className = "tree-category-header";
    if (expandedCategories.has(cat.path)) header.classList.add("expanded");
    header.innerHTML = `
      <div class="tree-category-title">
        <span class="tree-category-arrow ${expandedCategories.has(cat.path) ? 'expanded' : ''}">▶</span>
        <span>${cat.icon} ${cat.name}</span>
        <span style="color: #999; font-size: 0.9em;">(${entries.length} entries)</span>
      </div>
    `;
    header.onclick = () => toggleCategoryExpansion(cat.path);
    categoryDiv.appendChild(header);
    const content = document.createElement("div");
    content.className = "tree-category-content";
    if (expandedCategories.has(cat.path)) content.classList.add("expanded");
    if (entries.length > 0) {
      entries.forEach(entry => {
        const entryDiv = createDataEntryElement(entry);
        content.appendChild(entryDiv);
      });
    }
    if (cat.children && cat.children.length > 0) {
      renderDataTree(cat.children, content, dataGrouped);
    }
    categoryDiv.appendChild(content);
    parentElement.appendChild(categoryDiv);
  });
}

function checkHasData(category, dataGrouped) {
  if (dataGrouped[category.path] && dataGrouped[category.path].length > 0) return true;
  if (category.children) {
    return category.children.some(child => checkHasData(child, dataGrouped));
  }
  return false;
}

function toggleCategoryExpansion(path) {
  if (expandedCategories.has(path)) {
    expandedCategories.delete(path);
  } else {
    expandedCategories.add(path);
  }
  loadDataHistory();
}

function createDataEntryElement(entry) {
  const div = document.createElement("div");
  div.className = "data-entry";
  div.id = `entry_${entry.id}`;
  if (editingEntries.has(entry.id)) div.classList.add("editing");
  const isEditing = editingEntries.has(entry.id);
  div.innerHTML = `
    <div class="data-entry-header">
      <div class="data-entry-date">${new Date(entry.created_at).toLocaleString()}</div>
      <div class="data-entry-actions">
        ${isEditing ?
          `<button onclick="saveDataEntry('${entry.id}')" style="padding: 5px 15px;">Save</button>
           <button onclick="cancelEditDataEntry('${entry.id}')" class="secondary" style="padding: 5px 15px;">Cancel</button>` :
          `<button onclick="editDataEntry('${entry.id}')" class="secondary" style="padding: 5px 15px;">Edit</button>
           <button onclick="deleteDataEntry('${entry.id}')" class="danger" style="padding: 5px 15px;">Delete</button>`
        }
      </div>
    </div>
    <div class="data-entry-field">
      <label>Metric</label>
      <input type="text" value="${entry.metric_name}" disabled style="background: #1a1a2e; cursor: not-allowed;">
    </div>
    <div class="data-entry-field">
      <label>Value</label>
      <input type="number" step="any" id="value_${entry.id}" value="${entry.value}" ${isEditing ? '' : 'disabled'} style="${isEditing ? '' : 'background: #1a1a2e; cursor: not-allowed;'}">
    </div>
    <div class="data-entry-field">
      <label>Percentile</label>
      <input type="number" id="percentile_${entry.id}" value="${entry.percentile || ''}" ${isEditing ? '' : 'disabled'} style="${isEditing ? '' : 'background: #1a1a2e; cursor: not-allowed;'}">
    </div>
    <div class="data-entry-field">
      <label>Date/Time</label>
      <input type="datetime-local" id="datetime_${entry.id}" value="${new Date(entry.created_at).toISOString().slice(0, 16)}" ${isEditing ? '' : 'disabled'} style="${isEditing ? '' : 'background: #1a1a2e; cursor: not-allowed;'}">
    </div>
  `;
  return div;
}

function editDataEntry(entryId) {
  editingEntries.add(entryId);
  const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
  const entryElement = document.getElementById(`entry_${entryId}`);
  const entryOffsetTop = entryElement ? entryElement.offsetTop : null;

  loadDataHistory().then(() => {
    if (entryOffsetTop) {
      const reloadedEntry = document.getElementById(`entry_${entryId}`);
      if (reloadedEntry) {
        reloadedEntry.scrollIntoView({ block: 'center' });
      }
    } else {
      window.scrollTo(0, scrollPosition);
    }
  });
}

function cancelEditDataEntry(entryId) {
  editingEntries.delete(entryId);
  const entryElement = document.getElementById(`entry_${entryId}`);
  const entryOffsetTop = entryElement ? entryElement.offsetTop : null;

  loadDataHistory().then(() => {
    if (entryOffsetTop) {
      const reloadedEntry = document.getElementById(`entry_${entryId}`);
      if (reloadedEntry) {
        reloadedEntry.scrollIntoView({ block: 'center' });
      }
    }
  });
}

async function saveDataEntry(entryId) {
  const value = parseFloat(document.getElementById(`value_${entryId}`).value);
  const percentile = document.getElementById(`percentile_${entryId}`).value;
  const datetime = document.getElementById(`datetime_${entryId}`).value;
  const { error } = await supabase.from("metric_values").update({
    value,
    percentile: percentile ? parseFloat(percentile) : null,
    created_at: new Date(datetime).toISOString()
  }).eq("id", entryId);
  if (error) {
    alert("Failed to update entry");
    return;
  }
  editingEntries.delete(entryId);
  document.getElementById("status").textContent = "✅ Entry updated!";
  const entryElement = document.getElementById(`entry_${entryId}`);
  const entryOffsetTop = entryElement ? entryElement.offsetTop : null;

  await loadDataHistory();
  await loadDashboard();
  if (selectedCategory) await loadDetailStats(selectedCategory);

  if (entryOffsetTop) {
    const reloadedEntry = document.getElementById(`entry_${entryId}`);
    if (reloadedEntry) {
      reloadedEntry.scrollIntoView({ block: 'center' });
    }
  }
}

async function deleteDataEntry(entryId) {
  if (!confirm("Delete this entry permanently?")) return;
  const { error } = await supabase.from("metric_values").delete().eq("id", entryId);
  if (error) {
    alert("Failed to delete entry");
    return;
  }
  document.getElementById("status").textContent = "✅ Entry deleted!";
  await loadDataHistory();
  await loadDashboard();
  if (selectedCategory) await loadDetailStats(selectedCategory);
}

function clearFilters() {
  document.getElementById("filterCategory").value = "";
  document.getElementById("filterStartDate").value = "";
  document.getElementById("filterEndDate").value = "";
  loadDataHistory();
}

// ==================== END DATA HISTORY FUNCTIONS ====================

// ==================== DRILL-DOWN FUNCTIONS ====================

async function openDrillDown(path) {
  drillDownActive = true;
  drillDownCategory = path;
  selectedCategory = path;

  // Update selected state on cards
  if (typeof event !== 'undefined' && event?.target?.closest?.('.metric-card')) {
    document.querySelectorAll('.metric-card').forEach(btn => {
      btn.classList.remove('selected');
    });
    event.target.closest('.metric-card').classList.add('selected');
  }

  const category = categoryStructure.find(c => c.path === path);
  const subcategories = getChildren(path);

  // Update drill-down title
  document.getElementById('drillDownTitle').textContent = `${category.icon} ${category.name}`;

  // Animate transition
  const radarView = document.getElementById('radarView');
  const drillDownView = document.getElementById('drillDownView');
  
  radarView.style.opacity = '1';
  radarView.style.transform = 'scale(1)';
  
  // Fade out radar
  radarView.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
  radarView.style.opacity = '0';
  radarView.style.transform = 'scale(0.95)';
  
  await new Promise(resolve => setTimeout(resolve, 400));
  
  radarView.style.display = 'none';
  drillDownView.style.display = 'flex';
  drillDownView.style.opacity = '0';
  drillDownView.style.transform = 'scale(0.95)';
  
  // Fade in drill-down
  setTimeout(() => {
    drillDownView.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    drillDownView.style.opacity = '1';
    drillDownView.style.transform = 'scale(1)';
  }, 50);

  // Build subcategory selector
  const selector = document.getElementById('subcategorySelector');
  selector.innerHTML = '';
  
  if (subcategories.length > 0) {
    subcategories.forEach((subcat, idx) => {
      const btn = document.createElement('button');
      btn.className = 'subcategory-btn' + (idx === 0 ? ' active' : '');
      btn.textContent = `${subcat.icon} ${subcat.name}`;
      btn.onclick = () => selectSubcategory(subcat.path);
      selector.appendChild(btn);
    });
    
    // Load first subcategory by default
    drillDownSubcategory = subcategories[0].path;
  } else {
    // No subcategories, use main category
    drillDownSubcategory = path;
  }

  await loadBellCurve();
  await loadDrillHistoryChart();
}

function closeDrillDown() {
  drillDownActive = false;
  selectedCategory = null;

  // Update selected state on cards
  document.querySelectorAll('.metric-card').forEach(btn => {
    btn.classList.remove('selected');
  });

  const radarView = document.getElementById('radarView');
  const drillDownView = document.getElementById('drillDownView');
  
  // Fade out drill-down
  drillDownView.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
  drillDownView.style.opacity = '0';
  drillDownView.style.transform = 'scale(0.95)';
  
  setTimeout(async () => {
    drillDownView.style.display = 'none';
    radarView.style.display = 'block';
    radarView.style.opacity = '0';
    radarView.style.transform = 'scale(0.95)';
    
    // Fade in radar
    setTimeout(() => {
      radarView.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      radarView.style.opacity = '1';
      radarView.style.transform = 'scale(1)';
    }, 50);
  }, 400);
}

async function selectSubcategory(path) {
  drillDownSubcategory = path;
  
  // Update active button
  document.querySelectorAll('.subcategory-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  await loadBellCurve();
  await loadDrillHistoryChart();
}

async function loadBellCurve() {
  const { data, error } = await supabase
    .from("metric_values")
    .select("*")
    .eq("category_path", drillDownSubcategory)
    .order("created_at", { ascending: false });

// Replace your old error block with this:
if (error || !data || data.length === 0) {
  if (bellCurveChart) bellCurveChart.destroy();
  
  const canvas = document.getElementById('bellCurveChart');
  const parent = canvas.parentElement;

  // 1. Hide the canvas instead of destroying it
  canvas.style.display = 'none';

  // 2. Add or update a message div
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

// IMPORTANT: When you DO have data, show the canvas and remove the message
const canvas = document.getElementById('bellCurveChart');
canvas.style.display = 'block';
const existingMsg = canvas.parentElement.querySelector('.chart-error-msg');
if (existingMsg) existingMsg.remove();

  // Get latest percentile value
  const latestEntry = data[0];
  const percentile = latestEntry.percentile || 50;

  // Generate bell curve data
  const curveData = [];
  const labels = [];
  for (let i = 0; i <= 100; i++) {
    labels.push(i);
    // Normal distribution centered at 50, std dev of 15
    const x = i;
    const mean = 50;
    const stdDev = 15;
    const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * 
              Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
    curveData.push(y * 100); // Scale for visibility
  }

  const ctx = document.getElementById('bellCurveChart');
  if (bellCurveChart) bellCurveChart.destroy();

  const category = categoryStructure.find(c => c.path === drillDownSubcategory);
  
  bellCurveChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Population Distribution',
        data: curveData,
        borderColor: 'rgba(124, 92, 255, 0.5)',
        backgroundColor: 'rgba(124, 92, 255, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2
      }, {
        label: 'Your Position',
        data: labels.map(x => x === Math.round(percentile) ? Math.max(...curveData) * 1.1 : null),
        borderColor: 'rgba(61, 214, 255, 1)',
        backgroundColor: 'rgba(61, 214, 255, 1)',
        pointRadius: labels.map(x => x === Math.round(percentile) ? 8 : 0),
        pointStyle: 'triangle',
        borderWidth: 0,
        showLine: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `${category.icon} ${category.name} - Distribution`,
          color: '#e0e0e0',
          font: { size: 14, weight: '600' }
        },
        legend: {
          labels: { color: '#e0e0e0' }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              if (context.datasetIndex === 1 && context.parsed.y) {
                return `You are at ${percentile}th percentile`;
              }
              return `Percentile: ${context.label}`;
            }
          }
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
          title: {
            display: true,
            text: 'Frequency',
            color: '#999'
          },
          ticks: { color: '#999', display: false },
          grid: { color: 'rgba(255,255,255,0.1)' }
        }
      }
    }
  });
}

async function loadDrillHistoryChart() {
  const endDate = new Date();
  let startDate = new Date();

  if (drillChartSettings.scale === 'custom') {
    startDate = drillChartSettings.customStart ? new Date(drillChartSettings.customStart) : new Date(endDate - 180 * 24 * 60 * 60 * 1000);
    endDate.setTime(drillChartSettings.customEnd ? new Date(drillChartSettings.customEnd).getTime() : Date.now());
  } else {
    const units = drillChartSettings.units || 6;
    switch (drillChartSettings.scale) {
      case 'daily':
        startDate.setDate(startDate.getDate() - units);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - units * 7);
        break;
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - units);
        break;
      case 'yearly':
        startDate.setFullYear(startDate.getFullYear() - units);
        break;
    }
  }

  const { data, error } = await supabase
    .from("metric_values")
    .select("*")
    .eq("category_path", drillDownSubcategory)
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString())
    .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) {
      if (drillHistoryChart) drillHistoryChart.destroy();
      
      const canvas = document.getElementById('drillHistoryChart');
      const parent = canvas.parentElement;
  
      canvas.style.display = 'none';
  
      let msg = parent.querySelector('.history-error-msg');
      if (!msg) {
          msg = document.createElement('div');
          msg.className = 'history-error-msg';
          msg.style.cssText = "text-align: center; padding: 40px; color: #999;";
          parent.prepend(msg);
      }
      msg.textContent = 'No historical data available';
      return;
  }
  
  // Show canvas if data exists
  const historyCanvas = document.getElementById('drillHistoryChart');
  historyCanvas.style.display = 'block';
  const existingHistoryMsg = historyCanvas.parentElement.querySelector('.history-error-msg');
  if (existingHistoryMsg) existingHistoryMsg.remove();

  const aggregationScale = drillChartSettings.scale === 'custom' ?
    drillChartSettings.customAggregation :
    getAggregationLevel(drillChartSettings.scale);

  const aggregatedData = aggregateData(data, aggregationScale);

  const datasets = {};
  aggregatedData.forEach(entry => {
    const key = entry.metric_name;
    if (!datasets[key]) {
      datasets[key] = {
        label: entry.metric_name,
        data: [],
        tension: 0.3,
        borderWidth: 2
      };
    }
  });

  const labels = [];
  aggregatedData.forEach(entry => {
    const dateLabel = formatDateLabel(entry.date, aggregationScale);
    if (!labels.includes(dateLabel)) labels.push(dateLabel);

    const key = entry.metric_name;
    if (datasets[key] && entry.percentile !== null) {
      datasets[key].data.push({
        x: dateLabel,
        y: entry.percentile
      });
    }
  });

  const goalValue = currentGoals[drillDownSubcategory];
  const chartDatasets = Object.values(datasets);
  
  if (goalValue && labels.length > 0) {
    chartDatasets.push({
      label: '🎯 Goal Target',
      data: labels.map(label => ({ x: label, y: goalValue })),
      borderColor: 'rgba(124, 92, 255, 0.7)',
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      fill: false,
      tension: 0
    });
  }

  const ctx = document.getElementById('drillHistoryChart');
  if (drillHistoryChart) drillHistoryChart.destroy();

  const category = categoryStructure.find(c => c.path === drillDownSubcategory);

  drillHistoryChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: chartDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `${category.icon} ${category.name} - Progress Over Time`,
          color: '#e0e0e0',
          font: { size: 14, weight: '600' }
        },
        legend: {
          labels: { color: '#e0e0e0' }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          title: {
            display: true,
            text: 'Percentile',
            color: '#999'
          },
          ticks: { color: '#999' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        },
        x: {
          ticks: { color: '#999' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        }
      }
    }
  });
}

function updateDrillChartSettings() {
  const scale = document.getElementById('drillTimeScale').value;
  drillChartSettings.scale = scale;
  
  if (scale === 'custom') {
    document.getElementById('drillCustomDateRange').style.display = 'block';
    drillChartSettings.customStart = document.getElementById('drillCustomStartDate').value || null;
    drillChartSettings.customEnd = document.getElementById('drillCustomEndDate').value || null;
    drillChartSettings.customAggregation = document.getElementById('drillCustomAggregation').value || 'daily';
  } else {
    document.getElementById('drillCustomDateRange').style.display = 'none';
    drillChartSettings.units = parseInt(document.getElementById('drillTimeUnits').value) || 6;
    
    const unitLabel = document.getElementById('drillTimeUnitsLabel');
    switch (scale) {
      case 'daily':
        unitLabel.textContent = 'days';
        break;
      case 'weekly':
        unitLabel.textContent = 'weeks';
        break;
      case 'monthly':
        unitLabel.textContent = 'months';
        break;
      case 'yearly':
        unitLabel.textContent = 'years';
        break;
    }
  }
}

async function refreshDrillChart() {
  updateDrillChartSettings();
  await loadDrillHistoryChart();
}

// ==================== END DRILL-DOWN FUNCTIONS ====================

// Expose functions
window.switchTab = switchTab;
window.updateChartSettings = updateChartSettings;
window.refreshChart = refreshChart;
window.updateMetricInputs = updateMetricInputs;
window.calculatePercentileForMetric = calculatePercentileForMetric;
window.addMetricValues = addMetricValues;
window.openAddCategoryModal = openAddCategoryModal;
window.openAddSubCategoryModal = openAddSubCategoryModal;
window.openEditCategoryModal = openEditCategoryModal;
window.closeModal = closeModal;
window.addMetricField = addMetricField;
window.removeMetricField = removeMetricField;
window.saveCategory = saveCategory;
window.deleteCategory = deleteCategory;
window.saveWeights = saveWeights;
window.savePersonalInfo = savePersonalInfo;
window.loadDataHistory = loadDataHistory;
window.clearFilters = clearFilters;
window.editDataEntry = editDataEntry;
window.cancelEditDataEntry = cancelEditDataEntry;
window.saveDataEntry = saveDataEntry;
window.deleteDataEntry = deleteDataEntry;
window.saveGoals = saveGoals; // NEW
window.closeDrillDown = closeDrillDown;
window.updateDrillChartSettings = updateDrillChartSettings;
window.refreshDrillChart = refreshDrillChart;

// ==================== END DRILL-DOWN FUNCTIONS ====================

init();