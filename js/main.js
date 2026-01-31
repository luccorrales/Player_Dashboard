import { state } from './state/state.js';
import { loadPersonalInfo, savePersonalInfo } from './services/userService.js';
import { loadCategoryStructure, loadMetricDefinitions } from './services/categoryService.js';
import { loadWeights, saveWeights, loadGoals, saveGoals } from './services/weightsGoalsService.js';
import { loadDashboard, populateCategorySelectors } from './ui/dashboardRenderer.js';
import { populateDataHistoryFilters, loadDataHistory, clearFilters, editDataEntry, cancelEditDataEntry, saveDataEntry, deleteDataEntry } from './ui/dataHistoryUI.js';
import { updateMetricInputs, calculatePercentileForMetricInput, addMetricValuesHandler } from './ui/inputFormHandlers.js';
import { openAddCategoryModal, openAddSubCategoryModal, openEditCategoryModal, closeModal, addMetricField, removeMetricField, saveCategoryHandler } from './ui/modalHandlers.js';
import { switchTab, updateChartSettings, refreshChart, selectCategory } from './navigation/tabNavigation.js';
import { closeDrillDown, updateDrillChartSettings, refreshDrillChart } from './features/drillDown.js';

async function init() {
  document.getElementById("status").textContent = "✅ Connected to Supabase";
  
  await loadPersonalInfo();
  const categoriesLoaded = await loadCategoryStructure(false);

  if (categoriesLoaded) {
    await loadMetricDefinitions();
    populateCategorySelectors();
    populateDataHistoryFilters();
    await loadWeights();
    await loadGoals();
    await loadDashboard();
    document.getElementById("status").textContent = "✅ Dashboard initialized and connected!";
  } else {
    document.getElementById("status").textContent = "❌ Critical: Failed to load categories and defaults.";
  }
}

// Expose functions to window for HTML onclick handlers
window.switchTab = switchTab;
window.updateChartSettings = updateChartSettings;
window.refreshChart = refreshChart;
window.selectCategory = selectCategory;
window.updateMetricInputs = updateMetricInputs;
window.calculatePercentileForMetric = calculatePercentileForMetricInput;
window.addMetricValues = addMetricValuesHandler;
window.openAddCategoryModal = openAddCategoryModal;
window.openAddSubCategoryModal = openAddSubCategoryModal;
window.openEditCategoryModal = openEditCategoryModal;
window.closeModal = closeModal;
window.addMetricField = addMetricField;
window.removeMetricField = removeMetricField;
window.saveCategory = saveCategoryHandler;
window.saveWeights = saveWeights;
window.savePersonalInfo = savePersonalInfo;
window.loadDataHistory = loadDataHistory;
window.clearFilters = clearFilters;
window.editDataEntry = editDataEntry;
window.cancelEditDataEntry = cancelEditDataEntry;
window.saveDataEntry = saveDataEntry;
window.deleteDataEntry = deleteDataEntry;
window.saveGoals = saveGoals;
window.closeDrillDown = closeDrillDown;
window.updateDrillChartSettings = updateDrillChartSettings;
window.refreshDrillChart = refreshDrillChart;

init();
