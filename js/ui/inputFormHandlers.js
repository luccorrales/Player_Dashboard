import { state } from '../state/state.js';
import { addMetricValues, calculatePercentileForMetric } from '../services/metricService.js';
import { loadDashboard } from '../ui/dashboardRenderer.js';

export async function updateMetricInputs() {
  const categoryPath = document.getElementById("categoryPathSelect").value;
  const container = document.getElementById("metricInputsContainer");
  container.innerHTML = "";

  if (!categoryPath) return;

  const cat = state.categoryStructure.find(c => c.path === categoryPath);
  document.getElementById("inputBreadcrumb").textContent = `${cat.icon} ${cat.name}`;

  const metrics = state.metricDefinitions.filter(m => m.category_path === categoryPath);

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
             oninput="calculatePercentileForMetricInput(${metric.id})">
    `;
    container.appendChild(div);
  });
}

export async function calculatePercentileForMetricInput(metricId) {
  const metric = state.metricDefinitions.find(m => m.id === metricId);
  if (!metric || !metric.percentile_function) return;

  const value = parseFloat(document.getElementById(`metric_${metricId}`).value);
  if (isNaN(value)) return;

  try {
    const percentile = await calculatePercentileForMetric(metric.metric_name, value, "age_group");
    const displayEl = document.getElementById(`percentile_${metricId}`);
    if (displayEl && percentile !== null) {
      displayEl.textContent = `${Math.round(percentile)}th percentile`;
      displayEl.style.display = 'inline-block';
    }
  } catch (e) {
    console.error("Error calculating percentile:", e);
  }
}

export async function addMetricValuesHandler() {
  const categoryPath = document.getElementById("categoryPathSelect").value;
  const comparisonGroup = document.getElementById("comparisonGroup").value;

  if (!categoryPath) {
    alert("Please select a category");
    return;
  }

  const metrics = state.metricDefinitions.filter(m => m.category_path === categoryPath);
  const metricsToAdd = [];

  for (const metric of metrics) {
    const value = parseFloat(document.getElementById(`metric_${metric.id}`).value);
    if (!isNaN(value)) {
      metricsToAdd.push({
        name: metric.metric_name,
        value: value
      });
    }
  }

  if (metricsToAdd.length === 0) {
    alert("Please enter at least one metric value");
    return;
  }

  try {
    await addMetricValues(categoryPath, metricsToAdd, comparisonGroup);

    // Clear inputs
    metrics.forEach(metric => {
      const input = document.getElementById(`metric_${metric.id}`);
      if (input) input.value = "";
      const percentileDisplay = document.getElementById(`percentile_${metric.id}`);
      if (percentileDisplay) percentileDisplay.style.display = "none";
    });

    await loadDashboard();
    document.getElementById("status").textContent = "✅ Metric values added!";

  } catch (error) {
    console.error("Error adding metric values:", error);
    alert("Failed to add metric values");
  }
}
