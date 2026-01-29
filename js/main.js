import { percentileFunctions } from './percentile/index.js';
import { percentileFunctionsConfig } from './percentile/percentile-functions-config.js';

const SUPABASE_URL = "https://sugekxazhhxmbzncqxyg.supabase.co";
const SUPABASE_KEY = "sb_publishable_84h5tEu4ALMHkJWBxQeYdw_WqSSJiKd";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const Chart = window.Chart;

let categoryStructure = [];
let spiderChart, detailChart;
let currentWeights = {};
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

// INITIALIZE
async function init() {
  // 1. Initial status update (Keep for connection check)
  document.getElementById("status").textContent = "✅ Connected to Supabase";

  // 2. Load necessary reference data first
  await loadPersonalInfo();

  // Load categories (structure)
  const categoriesLoaded = await loadCategoryStructure(false); // Pass false to suppress internal population

  // 3. Load metric definitions (CRITICAL: Must happen before population)
  if (categoriesLoaded) {
    await loadMetricDefinitions();

    // 4. Now that metrics are defined, populate selectors and continue initialization
    populateCategorySelectors();
    populateDataHistoryFilters();

    await loadWeights();
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
  // Inline onclick relies on global `event`
  if (typeof event !== 'undefined' && event?.target) {
    event.target.classList.add('active');
  }

  if (tabName === 'manage') {
    renderCategoryHierarchy();
  } else if (tabName === 'datahistory') {
    loadDataHistory();
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

  // Add default metrics
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

function populateCategorySelectors() {
  // Populate dashboard category buttons (top-level only)
  const buttonContainer = document.getElementById("categoryButtons");
  buttonContainer.innerHTML = "";

  getTopLevelCategories().forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "category-btn";
    btn.innerHTML = `<span>${cat.icon} ${cat.name}</span><span>→</span>`;
    btn.onclick = () => selectCategory(cat.path);
    buttonContainer.appendChild(btn);
  });

  // Populate INPUT tab select (only categories with metrics)
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

  // Populate MODAL parent select (ALL categories)
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

  // Build parameters array
  const params = [value];
  if (metric.parameters && Array.isArray(metric.parameters)) {
    metric.parameters.forEach(param => {
      if (param === 'age' && userProfile.age) params.push(userProfile.age);
      if (param === 'gender' && userProfile.gender) params.push(userProfile.gender);
      if (param === 'bodyweight') {
        // Try to find bodyweight metric in current inputs
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

    // Calculate percentile if function exists
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

  // Clear inputs
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
  selectedCategory = path;

  // Only update button states if we clicked a category button (not a stat item)
  if (typeof event !== 'undefined' && event?.target?.closest?.('.category-btn')) {
    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.classList.remove('selected');
    });
    event.target.closest('.category-btn').classList.add('selected');
  }

  document.getElementById("detailPanel").style.display = "block";

  const breadcrumb = document.getElementById("breadcrumb");
  const pathParts = path.split('.');
  let breadcrumbHTML = "Home";
  let currentPath = "";

  pathParts.forEach((part, i) => {
    currentPath = i === 0 ? part : currentPath + "." + part;
    const cat = categoryStructure.find(c => c.path === currentPath);
    if (cat) {
      breadcrumbHTML += ` > ${cat.icon} ${cat.name}`;
    }
  });
  breadcrumb.textContent = breadcrumbHTML;

  const category = categoryStructure.find(c => c.path === path);
  document.getElementById("detailTitle").textContent = `${category.icon} ${category.name}`;

  await loadDetailStats(path);
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

    // Check if child has direct data
    if (childData) {
      Object.keys(childData).forEach(metricName => {
        const latest = childData[metricName][0];
        const statItem = document.createElement("div");
        statItem.className = "stat-item";
        statItem.style.cursor = "pointer";
        statItem.onclick = () => selectCategory(child.path);
        statItem.innerHTML = `
          <h4>${child.icon} ${child.name} - ${metricName}</h4>
          <div class="stat-value">${latest.value}</div>
          <div class="stat-percentile">${latest.percentile ? latest.percentile + 'th percentile' : 'No percentile'}</div>
        `;
        statsGrid.appendChild(statItem);
      });
    } else {
      // Child has no direct data - check if it has children with data
      const grandchildren = getChildren(child.path);
      const grandchildrenPaths = grandchildren.map(gc => gc.path);

      // Collect all data from grandchildren
      const grandchildrenData = [];
      grandchildrenPaths.forEach(gcPath => {
        if (grouped[gcPath]) {
          Object.values(grouped[gcPath]).forEach(metricArray => {
            grandchildrenData.push(...metricArray);
          });
        }
      });

      // If grandchildren have data, show aggregated stat for parent
      if (grandchildrenData.length > 0) {
        // Calculate average percentile from latest entries of each grandchild metric
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
          statItem.style.cursor = "pointer";
          statItem.onclick = () => selectCategory(child.path);
          statItem.innerHTML = `
            <h4>${child.icon} ${child.name}</h4>
            <div class="stat-value">Aggregated</div>
            <div class="stat-percentile">${avgPercentile}th percentile (avg of ${percentiles.length} metrics)</div>
            <div style="font-size: 0.8em; color: #999; margin-top: 5px;">
              ${grandchildren.length} subcategories
            </div>
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

// LOAD DETAIL CHART
async function loadDetailChart(path) {
  // Collect all descendant paths for chart (include all levels below)
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

  // Calculate date range based on settings
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

  // Determine aggregation level
  const aggregationScale = chartSettings.scale === 'custom' ?
    chartSettings.customAggregation :
    getAggregationLevel(chartSettings.scale);

  // Aggregate data
  const aggregatedData = aggregateData(data, aggregationScale);

  // Build datasets
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

  detailChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: Object.values(datasets)
    },
    options: {
      responsive: true,
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

// Get aggregation level (one level below selected scale)
function getAggregationLevel(scale) {
  const levels = ['hourly', 'daily', 'weekly', 'monthly', 'yearly'];
  const currentIndex = levels.indexOf(scale);
  return currentIndex > 0 ? levels[currentIndex - 1] : 'hourly';
}

// Aggregate data by time period
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
        periodKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        break;
      case 'weekly': {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
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

  // Calculate averages
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

// Format date label based on aggregation
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

// Update chart settings UI
function updateChartSettings() {
  const scale = document.getElementById("timeScale").value;
  const units = document.getElementById("timeUnits").value;

  chartSettings.scale = scale;
  chartSettings.units = parseInt(units);

  // Update label
  const labelMap = {
    daily: 'days',
    weekly: 'weeks',
    monthly: 'months',
    yearly: 'years'
  };
  document.getElementById("timeUnitsLabel").textContent = labelMap[scale] || '';

  // Show/hide custom date range
  const customRange = document.getElementById("customDateRange");
  if (scale === 'custom') {
    customRange.style.display = 'block';
    document.getElementById("timeUnits").disabled = true;

    // Set default dates if empty
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

// Refresh chart with current settings
function refreshChart() {
  if (chartSettings.scale === 'custom') {
    chartSettings.customStart = document.getElementById("customStartDate").value;
    chartSettings.customEnd = document.getElementById("customEndDate").value;
    chartSettings.customAggregation = document.getElementById("customAggregation").value;
  }

  if (selectedCategory) {
    loadDetailChart(selectedCategory);
  }
}

// LOAD SPIDER CHART
async function loadDashboard() {
  const topLevel = getTopLevelCategories();
  const categoryAverages = {};

  for (const cat of topLevel) {
    const descendants = getDescendants(cat.path);
    const allPaths = [cat.path, ...descendants.map(d => d.path)];

    const { data } = await supabase
      .from("metric_values")
      .select("percentile")
      .in("category_path", allPaths)
      .not("percentile", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data && data.length > 0) {
      const avg = data.reduce((sum, d) => sum + d.percentile, 0) / data.length;
      categoryAverages[cat.path] = avg;
    } else {
      categoryAverages[cat.path] = 0;
    }
  }

  const ctx = document.getElementById("spiderChart");
  if (spiderChart) spiderChart.destroy();

  spiderChart = new Chart(ctx, {
    type: "radar",
    data: {
      labels: topLevel.map(c => c.icon + " " + c.name),
      datasets: [{
        label: "Current Percentiles",
        data: topLevel.map(c => categoryAverages[c.path] || 0),
        backgroundColor: "rgba(102, 126, 234, 0.3)",
        borderColor: "#667eea",
        borderWidth: 2,
        pointBackgroundColor: "#667eea",
        pointBorderColor: "#fff",
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: { color: '#e0e0e0' }
        }
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 20,
            color: '#e0e0e0',
            backdropColor: 'transparent'
          },
          grid: { color: '#3a3a4e' },
          pointLabels: { color: '#e0e0e0' }
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
}

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

  // Load existing metrics
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
    // Creating new category
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
    // Editing existing category
    const originalPath = document.getElementById("modalOriginalPath").value || editPath;
    const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newPath = parentPath ? `${parentPath}.${safeName}` : safeName;

    // If path changed (parent or name changed)
    if (newPath !== originalPath) {
      const descendants = getDescendants(originalPath);

      // Update the category itself
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

      // Update all descendants
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

      // Update metrics and values for this category
      await supabase.from("metric_definitions").update({ category_path: newPath }).eq("category_path", originalPath);
      await supabase.from("metric_values").update({ category_path: newPath }).eq("category_path", originalPath);

      path = newPath;
    } else {
      // Just updating name/icon
      const { error: catError } = await supabase.from("category_structure").update({ name, icon: icon || "" }).eq("path", path);
      if (catError) {
        console.error(catError);
        alert("Failed to update category");
        return;
      }
    }

    // Delete removed metrics and update existing ones
    const existingMetrics = metricDefinitions.filter(m => m.category_path === path);
    const metricsToKeep = [];

    for (let i = 0; i < metricFieldCounter; i++) {
      const metricIdField = document.getElementById(`metricId_${i}`);
      if (metricIdField) {
        metricsToKeep.push(metricIdField.value);
      }
    }

    // Delete metrics not in the form
    for (const metric of existingMetrics) {
      if (!metricsToKeep.includes(metric.id)) {
        await supabase.from("metric_definitions").delete().eq("id", metric.id);
      }
    }
  }

  // Save/update metrics
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
        // Update existing metric
        await supabase
          .from("metric_definitions")
          .update(metricData)
          .eq("id", metricId);
      } else {
        // Insert new metric
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

// RENDER CATEGORY HIERARCHY
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

// DELETE CATEGORY
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
  if (filterStartDate) query = query.gte("created_at", new Date(filterStartDate).toISOString());
  if (filterEndDate) {
    const endDate = new Date(filterEndDate);
    endDate.setHours(23, 59, 59, 999);
    query = query.lte("created_at", endDate.toISOString());
  }
  const { data, error } = await query;
  if (error) {
    container.innerHTML = "<p class='no-data-message'>Error loading data</p>";
    return;
  }
  if (!data || data.length === 0) {
    container.innerHTML = "<p class='no-data-message'>No data entries found</p>";
    return;
  }
  const grouped = {};
  data.forEach(entry => {
    if (!grouped[entry.category_path]) grouped[entry.category_path] = [];
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

  // Store scroll position before reload
  const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
  const entryElement = document.getElementById(`entry_${entryId}`);
  const entryOffsetTop = entryElement ? entryElement.offsetTop : null;

  // Reload data history
  loadDataHistory().then(() => {
    // Restore scroll position after reload
    if (entryOffsetTop) {
      // Scroll instantly to the entry being edited
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

  // Store entry position before reload
  const entryElement = document.getElementById(`entry_${entryId}`);
  const entryOffsetTop = entryElement ? entryElement.offsetTop : null;

  // Reload data history
  loadDataHistory().then(() => {
    // Scroll instantly back to the entry
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
  // Store entry position before reload
  const entryElement = document.getElementById(`entry_${entryId}`);
  const entryOffsetTop = entryElement ? entryElement.offsetTop : null;

  await loadDataHistory();
  await loadDashboard();
  if (selectedCategory) await loadDetailStats(selectedCategory);

  // Scroll instantly back to the updated entry
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

// Expose functions referenced by inline HTML handlers
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

init();
