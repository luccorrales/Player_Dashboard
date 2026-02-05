// js/ui/inputFormHandlers.js
import { state } from '../state/state.js';
import { addMetricValues, calculatePercentileForMetric } from '../services/metricService.js';
import { loadDashboard } from '../ui/dashboardRenderer.js';
import { calculateOneRM } from '../utils/helpers.js';

/**
 * Renders the input fields based on the selected category
 */
export async function updateMetricInputs() {
  const categoryPath = document.getElementById("categoryPathSelect").value;
  const container = document.getElementById("metricInputsContainer");
  container.innerHTML = "";

  if (!categoryPath) return;

  const cat = state.categoryStructure.find(c => c.path === categoryPath);
  if (cat) {
    document.getElementById("inputBreadcrumb").textContent = `${cat.icon} ${cat.name}`;
  }

  const metrics = state.metricDefinitions.filter(m => m.category_path === categoryPath);

  if (metrics.length === 0) {
    container.innerHTML = "<p style='color: #999;'>No metrics defined for this category.</p>";
    return;
  }

  metrics.forEach(metric => {
    const div = document.createElement("div");
    div.className = "metric-input-group";
  
    // Identify metrics that need Weight + Reps logic
    const isStrengthMetric = [
      "Bench Press",
      "Squat",
      "Deadlift",
      "Shoulder Press",
    
      // Upper body compound
      "Lat Pulldown",
      "Seated Row (Close)",
      "Seated Row (Wide)",
    
      // Isolation / accessory
      "Lateral Raise",
      "Bicep Curl",
      "Tricep Extension",
    
      // Lower body machines
      "Leg Extension",
      "Leg Curl"
    ].includes(metric.metric_name);

  
    if (isStrengthMetric) {
      div.innerHTML = `
        <div class="metric-label">
          <label>${metric.metric_name} (Est. 1RM)</label>
          <span class="calculated-percentile" id="percentile_${metric.id}" style="display: none;"></span>
        </div>
        <div class="dual-input-row" style="display: flex; gap: 10px; margin-bottom: 5px;">
          <input type="number" id="weight_${metric.id}" placeholder="Weight" 
                 oninput="window.handleStrengthInput('${metric.id}')">
          <input type="number" id="reps_${metric.id}" placeholder="Reps" 
                 oninput="window.handleStrengthInput('${metric.id}')">
          <input type="hidden" id="metric_${metric.id}"> 
        </div>
        <div id="display_1rm_${metric.id}" style="font-size: 0.85em; color: var(--text-secondary); margin-bottom: 10px; display: none;"></div>
      `;
    } else {
      div.innerHTML = `
        <div class="metric-label">
          <label>${metric.metric_name} (${metric.unit || ''})</label>
          <span class="calculated-percentile" id="percentile_${metric.id}" style="display: none;"></span>
        </div>
        <input type="number" step="any" id="metric_${metric.id}"
               placeholder="Enter ${metric.metric_name.toLowerCase()}"
               oninput="window.calculatePercentileForMetricInput('${metric.id}')">
      `;
    }
    container.appendChild(div);
  });
}

/**
 * Logic for handling Weight and Reps inputs
 */
export function handleStrengthInput(metricId) {
  const weightVal = parseFloat(document.getElementById(`weight_${metricId}`).value);
  const repsVal = parseInt(document.getElementById(`reps_${metricId}`).value);
  const hiddenInput = document.getElementById(`metric_${metricId}`);
  const displayLabel = document.getElementById(`display_1rm_${metricId}`);

  if (!isNaN(weightVal) && !isNaN(repsVal) && repsVal > 0) {
    const estimatedMax = calculateOneRM(weightVal, repsVal);
    const roundedMax = Math.round(estimatedMax);

    // Update the hidden input that the Save function reads
    if (hiddenInput) {
      hiddenInput.value = roundedMax;
      console.log(`Set 1RM for metric ${metricId}: ${roundedMax}`);
    }

    // Show the user the calculated value
    if (displayLabel) {
      displayLabel.textContent = `Estimated 1RM: ${roundedMax} lbs`;
      displayLabel.style.display = "block";
    }

    // Trigger percentile calculation with a slight delay to ensure DOM is updated
    setTimeout(() => {
      window.calculatePercentileForMetricInput(metricId);
    }, 10);
  } else {
    if (hiddenInput) hiddenInput.value = "";
    if (displayLabel) displayLabel.style.display = "none";
    const percentileEl = document.getElementById(`percentile_${metricId}`);
    if (percentileEl) percentileEl.style.display = "none";
  }
}

/**
 * Calculates and displays the percentile for a specific input
 */
export async function calculatePercentileForMetricInput(metricId) {
  const metric = state.metricDefinitions.find(m => m.id === metricId);
  const inputEl = document.getElementById(`metric_${metricId}`);
  
  if (!metric) {
    console.warn(`Metric definition not found for ID: ${metricId}`);
    return;
  }
  
  if (!metric.percentile_function) {
    console.warn(`No percentile function defined for metric: ${metric.metric_name}`);
    return;
  }
  
  if (!inputEl) {
    console.warn(`Input element not found for metric ID: ${metricId}`);
    return;
  }

  const val = parseFloat(inputEl.value);
  console.log(`Calculating percentile for ${metric.metric_name}, value: ${val}`);
  
  if (isNaN(val)) {
    document.getElementById(`percentile_${metricId}`).style.display = "none";
    return;
  }

  try {
    const percentile = await calculatePercentileForMetric(metric.metric_name, val, "age_group");
    console.log(`Percentile result for ${metric.metric_name}: ${percentile}`);
    
    const displayEl = document.getElementById(`percentile_${metricId}`);
    
    if (displayEl && percentile !== null) {
      displayEl.textContent = `${Math.round(percentile)}th percentile`;
      displayEl.style.display = 'inline-block';
    }
  } catch (e) {
    console.error("Error calculating percentile:", e);
  }
}

/**
 * Saves all entered metrics to the database
 */
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
    const input = document.getElementById(`metric_${metric.id}`);
    const weightInput = document.getElementById(`weight_${metric.id}`);
    const repsInput = document.getElementById(`reps_${metric.id}`);
    
    // Check if this is a strength metric with raw inputs
    const hasRawInputs = weightInput && repsInput && weightInput.value && repsInput.value;
    
    if (input && input.value !== "") {
      const val = parseFloat(input.value);
      if (!isNaN(val)) {
        const metricData = {
          name: metric.metric_name,
          value: Math.round(val)
        };
        
        // If we have raw inputs (weight/reps), include them
        if (hasRawInputs) {
          metricData.raw_input_1 = parseFloat(weightInput.value);
          metricData.raw_input_2 = parseFloat(repsInput.value);
        }
        
        metricsToAdd.push(metricData);
      }
    }
  }

  if (metricsToAdd.length === 0) {
    alert("Please enter at least one metric value");
    return;
  }

  try {
    document.getElementById("status").textContent = "Saving...";
    await addMetricValues(categoryPath, metricsToAdd, comparisonGroup);

    // Reset Form
    metrics.forEach(metric => {
      const ids = [`metric_${metric.id}`, `weight_${metric.id}`, `reps_${metric.id}`];
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      
      const pDisplay = document.getElementById(`percentile_${metric.id}`);
      if (pDisplay) pDisplay.style.display = "none";
      
      const rDisplay = document.getElementById(`display_1rm_${metric.id}`);
      if (rDisplay) rDisplay.style.display = "none";
    });

    await loadDashboard();
    document.getElementById("status").textContent = "✅ Metric values added!";

  } catch (error) {
    console.error("Error adding metric values:", error);
    alert("Failed to add metric values");
  }
}

// CRITICAL: Expose functions to the global window object so HTML oninput can find them
window.handleStrengthInput = handleStrengthInput;
window.calculatePercentileForMetricInput = calculatePercentileForMetricInput;
window.updateMetricInputs = updateMetricInputs;
window.addMetricValuesHandler = addMetricValuesHandler;
