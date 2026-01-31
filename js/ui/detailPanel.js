import { state } from '../state/state.js';
import { supabase } from '../config/supabase.js';
import { getChildren } from '../services/categoryService.js';
import { loadDetailChart } from './chartRenderer.js';

export async function loadDetailPanel(path) {
  await loadDetailStats(path);
}

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
    const childGoal = state.currentGoals[child.path];

    if (childData) {
      Object.keys(childData).forEach(metricName => {
        const latest = childData[metricName][0];
        const statItem = document.createElement("div");
        statItem.className = "stat-item";
        if (childGoal) statItem.classList.add('has-goal');
        statItem.style.cursor = "pointer";
        statItem.onclick = async () => {
          const { selectCategory } = await import('../navigation/tabNavigation.js');
          selectCategory(child.path);
        };
        statItem.innerHTML = `
          <h4>${child.icon} ${child.name} - ${metricName}</h4>
          <div class="stat-value">${latest.value}</div>
          <div class="stat-percentile">${latest.percentile ? latest.percentile + 'th percentile' : 'No percentile'}</div>
          ${childGoal ? `<div style="font-size: 0.85em; color: #999; margin-top: 8px;">🎯 Goal: ${childGoal}th</div>` : ''}
        `;
        statsGrid.appendChild(statItem);
      });
    } else {
      const grandchildren = getChildren(child.path);
      const grandchildrenPaths = grandchildren.map(gc => gc.path);

      const grandchildrenData = [];
      grandchildrenPaths.forEach(gcPath => {
        if (grouped[gcPath]) {
          Object.values(grouped[gcPath]).forEach(metricArray => {
            grandchildrenData.push(...metricArray);
          });
        }
      });

      if (grandchildrenData.length > 0) {
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
          if (childGoal) statItem.classList.add('has-goal');
          statItem.style.cursor = "pointer";
          statItem.onclick = async () => {
            const { selectCategory } = await import('../navigation/tabNavigation.js');
            selectCategory(child.path);
          };
          statItem.innerHTML = `
            <h4>${child.icon} ${child.name}</h4>
            <div class="stat-value">Aggregated</div>
            <div class="stat-percentile">${avgPercentile}th percentile (avg of ${percentiles.length} metrics)</div>
            <div style="font-size: 0.8em; color: #999; margin-top: 5px;">
              ${grandchildren.length} subcategories
            </div>
            ${childGoal ? `<div style="font-size: 0.85em; color: #999; margin-top: 8px;">🎯 Goal: ${childGoal}th</div>` : ''}
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
