import { state } from '../state/state.js';
import { supabase, Chart } from '../config/supabase.js';
import { getChildren } from '../services/categoryService.js';
import { formatDateLabel, getAggregationLevel, aggregateData } from '../utils/helpers.js';

export async function openDrillDown(categoryPath) {
  state.drillDown.active = true;
  state.drillDown.category = categoryPath;

  const subcategories = getChildren(categoryPath);
  if (subcategories.length === 0) {
    state.drillDown.subcategory = categoryPath;
  } else {
    state.drillDown.subcategory = subcategories[0].path;
  }

  document.getElementById("radarView").style.display = "none";
  document.getElementById("drillDownView").style.display = "block";

  const category = state.categoryStructure.find(c => c.path === categoryPath);
  document.getElementById("drillDownTitle").textContent = `${category.icon} ${category.name}`;

  renderSubcategorySelector(categoryPath);
  await loadBellCurveChart();
  await loadDrillHistoryChart();
}

export function closeDrillDown() {
  state.drillDown.active = false;
  state.drillDown.category = null;
  state.drillDown.subcategory = null;

  document.getElementById("radarView").style.display = "block";
  document.getElementById("drillDownView").style.display = "none";

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
  const subcategories = getChildren(categoryPath);
  const selector = document.getElementById("subcategorySelector");

  if (subcategories.length === 0) {
    selector.style.display = "none";
    return;
  }

  selector.style.display = "flex";
  selector.innerHTML = "";

  subcategories.forEach(sub => {
    const button = document.createElement("button");
    button.className = "subcategory-button";
    button.textContent = `${sub.icon} ${sub.name}`;
    button.onclick = async () => {
      state.drillDown.subcategory = sub.path;
      document.querySelectorAll(".subcategory-button").forEach(b => b.classList.remove("active"));
      button.classList.add("active");
      await loadBellCurveChart();
      await loadDrillHistoryChart();
    };

    if (sub.path === state.drillDown.subcategory) {
      button.classList.add("active");
    }

    selector.appendChild(button);
  });
}

async function loadBellCurveChart() {
  const { data, error } = await supabase
    .from("metric_values")
    .select("percentile")
    .eq("category_path", state.drillDown.subcategory)
    .not("percentile", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data || data.length === 0) {
    const canvas = document.getElementById('bellCurveChart');
    if (state.drillDown.bellCurveChart) {
      state.drillDown.bellCurveChart.destroy();
      state.drillDown.bellCurveChart = null;
    }
    canvas.style.display = 'none';
    return;
  }

  const percentiles = data.map(d => d.percentile);
  const bins = Array(10).fill(0);

  percentiles.forEach(p => {
    const binIndex = Math.min(Math.floor(p / 10), 9);
    bins[binIndex]++;
  });

  const canvas = document.getElementById('bellCurveChart');
  canvas.style.display = 'block';

  if (state.drillDown.bellCurveChart) {
    state.drillDown.bellCurveChart.destroy();
  }

  state.drillDown.bellCurveChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['0-10', '10-20', '20-30', '30-40', '40-50', '50-60', '60-70', '70-80', '80-90', '90-100'],
      datasets: [{
        label: 'Frequency',
        data: bins,
        backgroundColor: 'rgba(124, 92, 255, 0.6)',
        borderColor: 'rgba(124, 92, 255, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Distribution of Your Scores',
          color: '#e0e0e0'
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

  if (state.drillDown.settings.scale === 'custom') {
    startDate = state.drillDown.settings.customStart ? 
      new Date(state.drillDown.settings.customStart) : 
      new Date(endDate - 180 * 24 * 60 * 60 * 1000);
    endDate.setTime(state.drillDown.settings.customEnd ? 
      new Date(state.drillDown.settings.customEnd).getTime() : 
      Date.now());
  } else {
    const units = state.drillDown.settings.units || 6;
    switch (state.drillDown.settings.scale) {
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
    .eq("category_path", state.drillDown.subcategory)
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString())
    .order("created_at", { ascending: true });

  const canvas = document.getElementById('drillHistoryChart');

  if (error || !data || data.length === 0) {
    if (state.drillDown.historyChart) {
      state.drillDown.historyChart.destroy();
      state.drillDown.historyChart = null;
    }
    canvas.style.display = 'none';
    return;
  }

  canvas.style.display = 'block';

  const aggregationScale = state.drillDown.settings.scale === 'custom' ?
    state.drillDown.settings.customAggregation :
    getAggregationLevel(state.drillDown.settings.scale);

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

  const goalValue = state.currentGoals[state.drillDown.subcategory];
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

  if (state.drillDown.historyChart) {
    state.drillDown.historyChart.destroy();
  }

  const category = state.categoryStructure.find(c => c.path === state.drillDown.subcategory);

  state.drillDown.historyChart = new Chart(canvas, {
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

export function updateDrillChartSettings() {
  const scale = document.getElementById('drillTimeScale').value;
  state.drillDown.settings.scale = scale;

  if (scale === 'custom') {
    document.getElementById('drillCustomDateRange').style.display = 'block';
    state.drillDown.settings.customStart = document.getElementById('drillCustomStartDate').value || null;
    state.drillDown.settings.customEnd = document.getElementById('drillCustomEndDate').value || null;
    state.drillDown.settings.customAggregation = document.getElementById('drillCustomAggregation').value || 'daily';
  } else {
    document.getElementById('drillCustomDateRange').style.display = 'none';
    state.drillDown.settings.units = parseInt(document.getElementById('drillTimeUnits').value) || 6;

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

export async function refreshDrillChart() {
  updateDrillChartSettings();
  await loadDrillHistoryChart();
}
