import { state } from '../state/state.js';
import { supabase } from '../config/supabase.js';
import { updateMetricValue, deleteMetricValue } from '../services/metricService.js';
import { calculateOneRM } from '../utils/helpers.js';

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
        // Create edit form with date field
        const editForm = document.createElement('div');
        
        // Convert created_at to local datetime format for input (YYYY-MM-DDTHH:mm)
        const dateObj = new Date(entry.created_at);
        const localDatetime = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000))
          .toISOString()
          .slice(0, 16);
        
        // Check if this entry has raw inputs (for strength exercises)
        const hasRawInputs = entry.raw_input_1 !== null && entry.raw_input_2 !== null;
        
        editForm.innerHTML = `
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 200px;">
              <label style="display: block; margin-bottom: 4px; font-size: 0.9em; color: #999;">Metric</label>
              <input type="text" id="edit_metric_${entry.id}" value="${entry.metric_name}" 
                     style="width: 100%; padding: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #fff;">
            </div>
            ${hasRawInputs ? `
            <div style="flex: 1; min-width: 120px;">
              <label style="display: block; margin-bottom: 4px; font-size: 0.9em; color: #999;">Weight</label>
              <input type="number" id="edit_raw_input_1_${entry.id}" value="${entry.raw_input_1}" 
                     class="raw-input-weight"
                     style="width: 100%; padding: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #fff;">
            </div>
            <div style="flex: 1; min-width: 120px;">
              <label style="display: block; margin-bottom: 4px; font-size: 0.9em; color: #999;">Reps</label>
              <input type="number" id="edit_raw_input_2_${entry.id}" value="${entry.raw_input_2}" 
                     class="raw-input-reps"
                     style="width: 100%; padding: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #fff;">
            </div>
            ` : ''}
            <div style="flex: 1; min-width: 150px;">
              <label style="display: block; margin-bottom: 4px; font-size: 0.9em; color: #999;">${hasRawInputs ? 'Est. 1RM' : 'Value'}</label>
              <input type="number" id="edit_value_${entry.id}" value="${entry.value}" 
                     style="width: 100%; padding: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #fff;"
                     ${hasRawInputs ? 'readonly' : ''}>
            </div>
            <div style="flex: 1; min-width: 150px;">
              <label style="display: block; margin-bottom: 4px; font-size: 0.9em; color: #999;">Percentile</label>
              <input type="number" id="edit_percentile_${entry.id}" value="${entry.percentile || ''}" 
                     style="width: 100%; padding: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #fff;">
            </div>
            <div style="flex: 1; min-width: 200px;">
              <label style="display: block; margin-bottom: 4px; font-size: 0.9em; color: #999;">Date & Time</label>
              <input type="datetime-local" id="edit_date_${entry.id}" value="${localDatetime}" 
                     style="width: 100%; padding: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #fff;">
            </div>
          </div>
          <div style="margin-top: 12px; display: flex; gap: 8px;">
            <button class="save-btn" style="padding: 6px 12px;">Save</button>
            <button class="cancel-btn secondary" style="padding: 6px 12px;">Cancel</button>
          </div>
        `;
        
        // Add event listeners for buttons
        const saveBtn = editForm.querySelector('.save-btn');
        const cancelBtn = editForm.querySelector('.cancel-btn');
        
        saveBtn.addEventListener('click', () => saveDataEntry(entry.id, hasRawInputs));
        cancelBtn.addEventListener('click', () => cancelEditDataEntry(entry.id));
        
        // Add 1RM calculation listeners if has raw inputs
        if (hasRawInputs) {
          const weightInput = editForm.querySelector('.raw-input-weight');
          const repsInput = editForm.querySelector('.raw-input-reps');
          const valueInput = document.getElementById(`edit_value_${entry.id}`);
          
          const updateCalculated1RM = () => {
            const weight = parseFloat(weightInput.value);
            const reps = parseFloat(repsInput.value);
            if (!isNaN(weight) && !isNaN(reps) && reps > 0) {
              const oneRM = calculateOneRM(weight, reps);
              valueInput.value = Math.round(oneRM);
            }
          };
          
          weightInput.addEventListener('input', updateCalculated1RM);
          repsInput.addEventListener('input', updateCalculated1RM);
        }
        
        entryDiv.appendChild(editForm);
      } else {
        // Create display view
        const displayDiv = document.createElement('div');
        
        // Check if this entry has raw inputs
        const hasRawInputs = entry.raw_input_1 !== null && entry.raw_input_2 !== null;
        
        let valueDisplay = '';
        if (hasRawInputs) {
          valueDisplay = `
            <div style="color: #999; font-size: 0.9em;">Weight: ${entry.raw_input_1} lbs × ${entry.raw_input_2} reps</div>
            <div style="color: #999; font-size: 0.9em;">Est. 1RM: ${entry.value} lbs</div>
          `;
        } else {
          valueDisplay = `<div style="color: #999; font-size: 0.9em;">Value: ${entry.value}</div>`;
        }
        
        displayDiv.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <div style="font-weight: 600; margin-bottom: 4px;">${entry.metric_name}</div>
              ${valueDisplay}
              <div style="color: #999; font-size: 0.9em;">Percentile: ${entry.percentile !== null ? entry.percentile + 'th' : 'N/A'}</div>
              <div style="color: #666; font-size: 0.85em; margin-top: 4px;">
                ${new Date(entry.created_at).toLocaleString()}
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="edit-btn secondary" style="padding: 4px 8px; font-size: 0.85em;">Edit</button>
              <button class="delete-btn danger" style="padding: 4px 8px; font-size: 0.85em;">Delete</button>
            </div>
          </div>
        `;
        
        // Add event listeners
        const editBtn = displayDiv.querySelector('.edit-btn');
        const deleteBtn = displayDiv.querySelector('.delete-btn');
        
        editBtn.addEventListener('click', () => editDataEntry(entry.id));
        deleteBtn.addEventListener('click', () => deleteDataEntry(entry.id));
        
        entryDiv.appendChild(displayDiv);
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

export async function saveDataEntry(id, hasRawInputs = false) {
  const metricName = document.getElementById(`edit_metric_${id}`).value;
  const value = parseFloat(document.getElementById(`edit_value_${id}`).value);
  const percentile = parseFloat(document.getElementById(`edit_percentile_${id}`).value);
  const dateInput = document.getElementById(`edit_date_${id}`).value;

  // Convert local datetime to ISO string
  const createdAt = new Date(dateInput).toISOString();

  const updates = {
    metric_name: metricName,
    value: value,
    percentile: isNaN(percentile) ? null : percentile,
    created_at: createdAt
  };

  // If this entry has raw inputs, update those too
  if (hasRawInputs) {
    const rawInput1 = parseFloat(document.getElementById(`edit_raw_input_1_${id}`).value);
    const rawInput2 = parseFloat(document.getElementById(`edit_raw_input_2_${id}`).value);
    updates.raw_input_1 = isNaN(rawInput1) ? null : rawInput1;
    updates.raw_input_2 = isNaN(rawInput2) ? null : rawInput2;
  }

  try {
    await updateMetricValue(id, updates);

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