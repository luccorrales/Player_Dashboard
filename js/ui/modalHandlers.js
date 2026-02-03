import { state } from '../state/state.js';
import { supabase } from '../config/supabase.js';
import { buildCategoryTree } from '../services/categoryService.js';
import { saveCategory, deleteCategory } from '../services/categoryService.js';
import { loadCategoryStructure, loadMetricDefinitions } from '../services/categoryService.js';

export function renderCategoryHierarchy() {
  const container = document.getElementById("categoryHierarchy");
  container.innerHTML = "";

  const tree = buildCategoryTree();

  function renderNode(node, parentDiv, level = 0) {
    const nodeDiv = document.createElement("div");
    nodeDiv.style.marginLeft = `${level * 20}px`;
    nodeDiv.style.padding = "8px";
    nodeDiv.style.marginBottom = "4px";
    nodeDiv.style.background = "rgba(255,255,255,0.03)";
    nodeDiv.style.borderRadius = "4px";
    nodeDiv.style.display = "flex";
    nodeDiv.style.alignItems = "center";
    nodeDiv.style.justifyContent = "space-between";

    const label = document.createElement("div");
    label.textContent = `${node.icon || ""} ${node.name} (${node.path})`;
    label.style.flex = "1";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.className = "secondary";
    editBtn.style.padding = "4px 8px";
    editBtn.style.fontSize = "0.85em";
    editBtn.onclick = () => openEditCategoryModal(node.path);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "danger";
    deleteBtn.style.padding = "4px 8px";
    deleteBtn.style.fontSize = "0.85em";
    deleteBtn.onclick = () => confirmDeleteCategory(node.path);

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    nodeDiv.appendChild(label);
    nodeDiv.appendChild(actions);
    parentDiv.appendChild(nodeDiv);

    if (node.children && node.children.length > 0) {
      node.children.forEach(child => renderNode(child, parentDiv, level + 1));
    }
  }

  tree.forEach(node => renderNode(node, container));
}

export function openAddCategoryModal() {
  document.getElementById("modalTitle").textContent = "Add New Category";
  document.getElementById("modalEditPath").value = "";
  document.getElementById("modalOriginalPath").value = "";
  document.getElementById("modalParentSelect").value = "";
  document.getElementById("modalCategoryName").value = "";
  document.getElementById("modalCategoryIcon").value = "";
  document.getElementById("metricsContainer").innerHTML = "";
  document.getElementById("categoryModal").style.display = "flex";
}

export function openAddSubCategoryModal() {
  if (!state.selectedCategory) {
    alert("Please select a parent category first from the dashboard");
    return;
  }
  document.getElementById("modalTitle").textContent = "Add Sub-Category";
  document.getElementById("modalEditPath").value = "";
  document.getElementById("modalOriginalPath").value = "";
  document.getElementById("modalParentSelect").value = state.selectedCategory;
  document.getElementById("modalCategoryName").value = "";
  document.getElementById("modalCategoryIcon").value = "";
  document.getElementById("metricsContainer").innerHTML = "";
  document.getElementById("categoryModal").style.display = "flex";
}

export function openEditCategoryModal(path) {
  const category = state.categoryStructure.find(c => c.path === path);
  if (!category) return;

  document.getElementById("modalTitle").textContent = "Edit Category";
  document.getElementById("modalEditPath").value = path;
  document.getElementById("modalOriginalPath").value = path;
  document.getElementById("modalParentSelect").value = category.parent_path || "";
  document.getElementById("modalCategoryName").value = category.name;
  document.getElementById("modalCategoryIcon").value = category.icon || "";

  const metrics = state.metricDefinitions.filter(m => m.category_path === path);
  const container = document.getElementById("metricsContainer");
  container.innerHTML = "";

  metrics.forEach((metric, idx) => {
    addMetricFieldWithData(metric, idx);
  });

  document.getElementById("categoryModal").style.display = "flex";
}

export function closeModal() {
  document.getElementById("categoryModal").style.display = "none";
}

export function addMetricField(metricData = null, index = null) {
  const container = document.getElementById("metricsContainer");
  const fieldId = index !== null ? index : container.children.length;

  const fieldDiv = document.createElement("div");
  fieldDiv.className = "metric-field";
  fieldDiv.style.border = "1px solid rgba(255,255,255,0.1)";
  fieldDiv.style.padding = "12px";
  fieldDiv.style.marginBottom = "8px";
  fieldDiv.style.borderRadius = "4px";

  fieldDiv.innerHTML = `
    <div class="form-group">
      <label>Metric Name</label>
      <input type="text" class="metric-name" placeholder="e.g., Bench Press" value="${metricData?.metric_name || ''}">
    </div>
    <div class="form-group">
      <label>Unit</label>
      <input type="text" class="metric-unit" placeholder="e.g., lbs" value="${metricData?.unit || ''}">
    </div>
    <div class="form-group">
      <label>Percentile Function</label>
      <input type="text" class="metric-function" placeholder="e.g., bench_press_percentile" value="${metricData?.percentile_function || ''}">
    </div>
    <div class="form-group">
      <label>Parameters (comma-separated)</label>
      <input type="text" class="metric-params" placeholder="e.g., value,age,bodyweight" value="${metricData?.parameters?.join(',') || ''}">
    </div>
    <button type="button" onclick="removeMetricField(${fieldId})" class="secondary" style="margin-top: 8px;">Remove Metric</button>
  `;

  fieldDiv.dataset.fieldId = fieldId;
  container.appendChild(fieldDiv);
}

function addMetricFieldWithData(metricData, index) {
  addMetricField(metricData, index);
}

export function removeMetricField(fieldId) {
  const container = document.getElementById("metricsContainer");
  const field = container.querySelector(`[data-field-id="${fieldId}"]`);
  if (field) {
    field.remove();
  }
}

export async function saveCategoryHandler() {
  const editPath = document.getElementById("modalEditPath").value;
  const originalPath = document.getElementById("modalOriginalPath").value;
  const parentPath = document.getElementById("modalParentSelect").value || null;
  const name = document.getElementById("modalCategoryName").value.trim();
  const icon = document.getElementById("modalCategoryIcon").value.trim();

  if (!name) {
    alert("Category name is required");
    return;
  }

  const pathSegment = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const fullPath = parentPath ? `${parentPath}.${pathSegment}` : pathSegment;

  const categoryData = {
    path: fullPath,
    name: name,
    icon: icon || null,
    parent_path: parentPath
  };

  try {
    await saveCategory(categoryData, !!editPath, originalPath);

    // Handle metrics
    const metricFields = document.querySelectorAll(".metric-field");
    const metrics = [];

    metricFields.forEach(field => {
      const metricName = field.querySelector(".metric-name").value.trim();
      const unit = field.querySelector(".metric-unit").value.trim();
      const func = field.querySelector(".metric-function").value.trim();
      const params = field.querySelector(".metric-params").value.trim();

      if (metricName) {
        metrics.push({
          category_path: fullPath,
          metric_name: metricName,
          unit: unit,
          percentile_function: func || null,
          parameters: params ? params.split(',').map(p => p.trim()) : null
        });
      }
    });

    if (metrics.length > 0) {
      await supabase.from("metric_definitions").delete().eq("category_path", fullPath);
      await supabase.from("metric_definitions").insert(metrics);
    }

    // CRITICAL FIX: Reload metric definitions after saving
    await loadMetricDefinitions();

    closeModal();
    await loadCategoryStructure(true);
    renderCategoryHierarchy();
    document.getElementById("status").textContent = "✅ Category saved!";

  } catch (error) {
    console.error("Error saving category:", error);
    alert("Failed to save category");
  }
}

async function confirmDeleteCategory(path) {
  if (!confirm(`Are you sure you want to delete category "${path}" and all its data?`)) {
    return;
  }

  try {
    await deleteCategory(path);
    renderCategoryHierarchy();
    document.getElementById("status").textContent = "✅ Category deleted!";
  } catch (error) {
    console.error("Error deleting category:", error);
    alert("Failed to delete category");
  }
}

export function renderGoalsForm() {
  const container = document.getElementById("goalsForm");
  container.innerHTML = "";

  const topLevel = state.categoryStructure.filter(c => !c.parent_path);

  topLevel.forEach(cat => {
    const goalDiv = document.createElement("div");
    goalDiv.className = "form-group";

    const currentGoal = state.currentGoals[cat.path] || "";

    goalDiv.innerHTML = `
      <label>${cat.icon} ${cat.name} Target Percentile</label>
      <input type="number" id="goal_${cat.path.replace(/\./g, '__')}" 
             value="${currentGoal}" 
             min="1" max="100" 
             placeholder="e.g., 75">
      <small style="color: #999;">Set your target percentile (1-100)</small>
    `;

    container.appendChild(goalDiv);
  });
}

export function renderWeightsForm() {
  const container = document.getElementById("weightsForm");
  container.innerHTML = "";

  const topLevel = state.categoryStructure.filter(c => !c.parent_path);

  topLevel.forEach(cat => {
    const weightDiv = document.createElement("div");
    weightDiv.className = "form-group";

    const currentWeight = state.currentWeights[cat.path] || 5;

    weightDiv.innerHTML = `
      <label>${cat.icon} ${cat.name} Importance</label>
      <input type="number" id="weight_${cat.path.replace(/\./g, '__')}" 
             value="${currentWeight}" 
             min="1" max="10" 
             placeholder="1-10">
      <small style="color: #999;">How important is this domain to you? (1-10)</small>
    `;

    container.appendChild(weightDiv);
  });
}