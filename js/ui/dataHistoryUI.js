import { state } from '../state/state.js';
import { supabase } from '../config/supabase.js';
import { updateMetricValue, deleteMetricValue } from '../services/metricService.js';

export function populateDataHistoryFilters() {
  const filterSelect = document.getElementById("filterCategory");
  filterSelect.innerHTML = '<option value="">All Categories</option>';

  state.categoryStructure.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat.path;
    option.textContent = `${cat.icon || ""} ${cat.name}`;
    filterSelect.appendChild(option);
  });
}

export async function loadDataHistory() {
  const filterCategory = document.getElementById("filterCategory").value;
  const filterStartDate = document.getElementById("filterStartDate").value;
  const filterEndDate = document.getElementById("filterEndDate").value;

  let query = supabase
    .from("metric_values")
    .select("*")
    .order("created_at", { ascending: false });

  if (filterCategory) {
    query = query.eq("category_path", filterCategory);
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
    console.error("Error loading data history:", error);
    return;
  }

  renderDataHistoryTree(data || []);
}

function renderDataHistoryTree(data) {
  const container = document.getElementById("dataHistoryTree");
  container.innerHTML = "";

  if (data.length === 0) {
    container.innerHTML = "<p style='color: #999; padding: 20px;'>No data entries found.</p>";
    return;
  }

  // Group by category
  const grouped = {};
  data.forEach(entry => {
    if (!grouped[entry.category_path]) {
      grouped[entry.category_path] = [];
    }
    grouped[entry.category_path].push(entry);
  });

  Object.keys(grouped).forEach(categoryPath => {
    const category = state.categoryStructure.find(c => c.path === categoryPath);
    const categorySection = document.createElement("div");
    categorySection.className = "data-category-section";
    categorySection.style.marginBottom = "20px";

    const header = document.createElement("div");
    header.className = "data-category-header";
    header.style.padding = "12px";
    header.style.background = "rgba(255,255,255,0.05)";
    header.style.borderRadius = "4px";
    header.style.marginBottom = "8px";
    header.style.fontWeight = "600";
    header.style.cursor = "pointer";
    header.textContent = `${category?.icon || ""} ${category?.name || categoryPath} (${grouped[categoryPath].length} entries)`;
    header.onclick = () => {
      const isExpanded = state.expandedCategories.has(categoryPath);
      if (isExpanded) {
        state.expandedCategories.delete(categoryPath);
        entriesContainer.style.display = "none";
      } else {
        state.expandedCategories.add(categoryPath);
        entriesContainer.style.display = "block";
      }
    };

    const entriesContainer = document.createElement("div");
    entriesContainer.className = "data-entries-container";
    entriesContainer.style.display = state.expandedCategories.has(categoryPath) ? "block" : "none";

    grouped[categoryPath].forEach(entry => {
      const entryDiv = document.createElement("div");
      entryDiv.className = "data-entry";
      entryDiv.style.padding = "12px";
      entryDiv.style.marginBottom = "8px";
      entryDiv.style.background = "rgba(255,255,255,0.02)";
      entryDiv.style.borderRadius = "4px";
      entryDiv.style.border = "1px solid rgba(255,255,255,0.1)";

      const isEditing = state.editingEntries.has(entry.id);

      if (isEditing) {
        entryDiv.innerHTML = `
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 200px;">
              <label style="display: block; margin-bottom: 4px; font-size: 0.9em; color: #999;">Metric</label>
              <input type="text" id="edit_metric_${entry.id}" value="${entry.metric_name}" 
                     style="width: 100%; padding: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #fff;">
            </div>
            <div style="flex: 1; min-width: 150px;">
              <label style="display: block; margin-bottom: 4px; font-size: 0.9em; color: #999;">Value</label>
              <input type="number" id="edit_value_${entry.id}" value="${entry.value}" 
                     style="width: 100%; padding: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #fff;">
            </div>
            <div style="flex: 1; min-width: 150px;">
              <label style="display: block; margin-bottom: 4px; font-size: 0.9em; color: #999;">Percentile</label>
              <input type="number" id="edit_percentile_${entry.id}" value="${entry.percentile || ''}" 
                     style="width: 100%; padding: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #fff;">
            </div>
          </div>
          <div style="margin-top: 12px; display: flex; gap: 8px;">
            <button onclick="saveDataEntry(${entry.id})" style="padding: 6px 12px;">Save</button>
            <button onclick="cancelEditDataEntry(${entry.id})" class="secondary" style="padding: 6px 12px;">Cancel</button>
          </div>
        `;
      } else {
        entryDiv.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <div style="font-weight: 600; margin-bottom: 4px;">${entry.metric_name}</div>
              <div style="color: #999; font-size: 0.9em;">Value: ${entry.value}</div>
              <div style="color: #999; font-size: 0.9em;">Percentile: ${entry.percentile !== null ? entry.percentile + 'th' : 'N/A'}</div>
              <div style="color: #666; font-size: 0.85em; margin-top: 4px;">
                ${new Date(entry.created_at).toLocaleString()}
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button onclick="editDataEntry(${entry.id})" class="secondary" style="padding: 4px 8px; font-size: 0.85em;">Edit</button>
              <button onclick="deleteDataEntry(${entry.id})" class="danger" style="padding: 4px 8px; font-size: 0.85em;">Delete</button>
            </div>
          </div>
        `;
      }

      entriesContainer.appendChild(entryDiv);
    });

    categorySection.appendChild(header);
    categorySection.appendChild(entriesContainer);
    container.appendChild(categorySection);
  });
}

export function clearFilters() {
  document.getElementById("filterCategory").value = "";
  document.getElementById("filterStartDate").value = "";
  document.getElementById("filterEndDate").value = "";
  loadDataHistory();
}

export function editDataEntry(id) {
  state.editingEntries.add(id);
  loadDataHistory();
}

export function cancelEditDataEntry(id) {
  state.editingEntries.delete(id);
  loadDataHistory();
}

export async function saveDataEntry(id) {
  const metricName = document.getElementById(`edit_metric_${id}`).value;
  const value = parseFloat(document.getElementById(`edit_value_${id}`).value);
  const percentile = parseFloat(document.getElementById(`edit_percentile_${id}`).value);

  try {
    await updateMetricValue(id, {
      metric_name: metricName,
      value: value,
      percentile: isNaN(percentile) ? null : percentile
    });

    state.editingEntries.delete(id);
    await loadDataHistory();
    document.getElementById("status").textContent = "✅ Entry updated!";
  } catch (error) {
    console.error("Error saving entry:", error);
    alert("Failed to save entry");
  }
}

export async function deleteDataEntry(id) {
  if (!confirm("Are you sure you want to delete this entry?")) {
    return;
  }

  try {
    await deleteMetricValue(id);
    await loadDataHistory();
    document.getElementById("status").textContent = "✅ Entry deleted!";
  } catch (error) {
    console.error("Error deleting entry:", error);
    alert("Failed to delete entry");
  }
}
