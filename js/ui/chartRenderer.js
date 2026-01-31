import { state } from '../state/state.js';
import { supabase, Chart } from '../config/supabase.js';
import { getTopLevelCategories, getChildren } from '../services/categoryService.js';
import { domIdFromPath, formatDateLabel, getAggregationLevel, aggregateData } from '../utils/helpers.js';

let pieChart, barChart;

export async function loadSpiderChart() {
  const topLevel = getTopLevelCategories();
  const categoryAverages = {};

  for (const cat of topLevel) {
    const descendants = getAllDescendants(cat.path);
    const allPaths = [cat.path, ...descendants.map(d => d.path)];

    const { data } = await supabase
      .from("metric_values")
      .select("percentile, metric_name, category_path, created_at")
      .in("category_path", allPaths)
      .not("percentile", "is", null)
      .order("created_at", { ascending: false })
      .limit(80);

    if (!data || data.length === 0) {
      categoryAverages[cat.path] = 0;
      continue;
    }

    const latestByMetric = new Map();
    for (const row of data) {
      const key = `${row.category_path}__${row.metric_name}`;
      if (!latestByMetric.has(key)) {
        latestByMetric.set(key, row.percentile);
      }
    }

    const latestVals = Array.from(latestByMetric.values()).filter(v => v !== null);
    categoryAverages[cat.path] = latestVals.length ? 
      latestVals.reduce((a, b) => a + b, 0) / latestVals.length : 0;
  }

  const ctx = document.getElementById("spiderChart");
  if (state.spiderChart) state.spiderChart.destroy();

  const radarGradient = (() => {
    const c = ctx.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, 320);
    g.addColorStop(0, 'rgba(124, 92, 255, 0.30)');
    g.addColorStop(1, 'rgba(61, 214, 255, 0.10)');
    return g;
  })();

  state.spiderChart = new Chart(ctx, {
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
}

export async function loadDashboardCharts() {
  const topLevel = getTopLevelCategories();
  const categoryAverages = {};

  for (const cat of topLevel) {
    const descendants = getAllDescendants(cat.path);
    const allPaths = [cat.path, ...descendants.map(d => d.path)];

    const { data } = await supabase
      .from("metric_values")
      .select("percentile")
      .in("category_path", allPaths)
      .not("percentile", "is", null)
      .order("created_at", { ascending: false });

    const percentiles = data?.map(d => d.percentile).filter(p => p != null) || [];
    categoryAverages[cat.path] = percentiles.length > 0 ?
      percentiles.reduce((a, b) => a + b, 0) / percentiles.length : 0;
  }

  await loadPieChart(topLevel, categoryAverages);
  await loadBarChart(topLevel, categoryAverages);
}

async function loadPieChart(topLevel, categoryAverages) {
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
        borderColor: 'rgba(20, 20, 30, 0.8)',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: '#e0e0e0', font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              return `${context.label}: ${Math.round(context.raw)}th percentile`;
            }
          }
        }
      }
    }
  });
}

async function loadBarChart(topLevel, categoryAverages) {
  const barCtx = document.getElementById("barChart");
  if (barChart) barChart.destroy();

  const barData = topLevel.map(cat => categoryAverages[cat.path] || 0);
  const barLabels = topLevel.map(cat => cat.icon);

  barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: barLabels,
      datasets: [{
        label: 'Percentile',
        data: barData,
        backgroundColor: 'rgba(124, 92, 255, 0.7)',
        borderColor: 'rgba(124, 92, 255, 1)',
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const idx = items[0].dataIndex;
              return topLevel[idx].name;
            }
          }
        }
      },
      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: { color: '#999' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        },
        y: {
          ticks: { color: '#e0e0e0', font: { size: 14 } },
          grid: { display: false }
        }
      }
    }
  });
}

export async function loadDetailChart(path) {
  const descendantPaths = getAllDescendantPaths(path);
  const allPaths = descendantPaths.length > 0 ? descendantPaths : [path];

  const endDate = new Date();
  let startDate = new Date();

  if (state.chartSettings.scale === 'custom') {
    startDate = state.chartSettings.customStart ? 
      new Date(state.chartSettings.customStart) : 
      new Date(endDate - 180 * 24 * 60 * 60 * 1000);
    endDate.setTime(state.chartSettings.customEnd ? 
      new Date(state.chartSettings.customEnd).getTime() : 
      Date.now());
  } else {
    const units = state.chartSettings.units || 6;
    switch (state.chartSettings.scale) {
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
  if (state.detailChart) state.detailChart.destroy();

  const aggregationScale = state.chartSettings.scale === 'custom' ?
    state.chartSettings.customAggregation :
    getAggregationLevel(state.chartSettings.scale);

  const aggregatedData = aggregateData(data, aggregationScale);

  const datasets = {};
  aggregatedData.forEach(entry => {
    const key = `${entry.category_path}_${entry.metric_name}`;
    if (!datasets[key]) {
      const cat = state.categoryStructure.find(c => c.path === entry.category_path);
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

  const goalValue = state.currentGoals[path];
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

  state.detailChart = new Chart(ctx, {
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

function getAllDescendants(path) {
  const direct = getChildren(path);
  let all = [...direct];
  direct.forEach(child => {
    all = all.concat(getAllDescendants(child.path));
  });
  return all;
}

function getAllDescendantPaths(parentPath) {
  const directChildren = getChildren(parentPath);
  let paths = directChildren.map(c => c.path);
  directChildren.forEach(child => {
    paths = paths.concat(getAllDescendantPaths(child.path));
  });
  return paths;
}
