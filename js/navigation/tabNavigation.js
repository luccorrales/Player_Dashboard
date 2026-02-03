import { state } from '../state/state.js';
import { renderCategoryHierarchy, renderGoalsForm, renderWeightsForm } from '../ui/modalHandlers.js';
import { loadDataHistory } from '../ui/dataHistoryUI.js';
import { openDrillDown, closeDrillDown } from '../features/drillDown.js';
import { loadDetailChart } from '../ui/chartRenderer.js';

export function switchTab(tabName) {
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
    renderGoalsForm();
  } else if (tabName === 'settings') {
    renderWeightsForm();
  }
}

export function updateChartSettings() {
  const scale = document.getElementById("timeScale").value;
  const units = document.getElementById("timeUnits").value;

  state.chartSettings.scale = scale;
  state.chartSettings.units = parseInt(units);

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

    state.chartSettings.customStart = document.getElementById("customStartDate").value;
    state.chartSettings.customEnd = document.getElementById("customEndDate").value;
    state.chartSettings.customAggregation = document.getElementById("customAggregation").value;
  } else {
    customRange.style.display = 'none';
    document.getElementById("timeUnits").disabled = false;
  }
}

export async function refreshChart() {
  if (state.chartSettings.scale === 'custom') {
    state.chartSettings.customStart = document.getElementById("customStartDate").value;
    state.chartSettings.customEnd = document.getElementById("customEndDate").value;
    state.chartSettings.customAggregation = document.getElementById("customAggregation").value;
  }

  const { loadDashboard } = await import('../ui/dashboardRenderer.js');
  
  await loadDashboard();

  if (state.selectedCategory) {
    await loadDetailChart(state.selectedCategory);
  }
}

export async function selectCategory(path) {
  // If clicking the same category that's already in drill-down, close it
  if (state.drillDown.active && state.drillDown.category === path) {
    closeDrillDown();
    state.selectedCategory = null;
    document.getElementById("detailPanel").style.display = "none";
    return;
  }

  // If a different category is active in drill-down, close it first
  if (state.drillDown.active) {
    closeDrillDown();
  }

  state.selectedCategory = path;

  const category = state.categoryStructure.find(c => c.path === path);
  const breadcrumb = document.getElementById("breadcrumb");
  if (breadcrumb) {
    breadcrumb.textContent = `${category?.icon || ''} ${category?.name || path}`;
  }

  // Show detail panel for breadcrumb and title
  document.getElementById("detailPanel").style.display = "block";
  document.getElementById("detailTitle").textContent = `${category?.icon || ''} ${category?.name || path}`;

  // Load the detail chart (this will be hidden when drill-down opens, but needed for when drill-down closes)
  await loadDetailChart(path);

  // Open drill-down view (this will fade out radar and fade in bell curve + timeline)
  await openDrillDown(path);
}