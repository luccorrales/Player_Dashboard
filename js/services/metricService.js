import { supabase } from '../config/supabase.js';
import { state } from '../state/state.js';
import { percentileFunctions } from '../percentile/index.js';

export async function loadMetricValues(categoryPath, startDate, endDate) {
  let query = supabase
    .from("metric_values")
    .select("*")
    .eq("category_path", categoryPath)
    .order("created_at", { ascending: true });

  if (startDate) {
    query = query.gte("created_at", startDate.toISOString());
  }
  if (endDate) {
    query = query.lte("created_at", endDate.toISOString());
  }

  const { data, error } = await query;
  
  if (error) {
    console.error("Error loading metric values:", error);
    return [];
  }
  
  return data || [];
}

export async function addMetricValues(categoryPath, metrics, comparisonGroup) {
  const entries = [];
  
  for (const metric of metrics) {
    const percentile = await calculatePercentileForMetric(
      metric.name,
      metric.value,
      comparisonGroup
    );
    
    entries.push({
      category_path: categoryPath,
      metric_name: metric.name,
      value: metric.value,
      percentile: percentile,
      comparison_group: comparisonGroup,
      created_at: new Date().toISOString()
    });
  }

  const { error } = await supabase
    .from("metric_values")
    .insert(entries);

  if (error) {
    throw error;
  }
  
  return entries;
}

export async function updateMetricValue(id, updates) {
  const { error } = await supabase
    .from("metric_values")
    .update(updates)
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function deleteMetricValue(id) {
  const { error } = await supabase
    .from("metric_values")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function calculatePercentileForMetric(metricName, value, comparisonGroup) {
  const metricDef = state.metricDefinitions.find(
    m => m.metric_name === metricName
  );

  if (!metricDef || !metricDef.percentile_function) {
    return null;
  }

  const funcName = metricDef.percentile_function;
  const func = percentileFunctions[funcName];

  if (!func) {
    console.warn(`Percentile function "${funcName}" not found`);
    return null;
  }

  const args = {};
  metricDef.parameters.forEach(param => {
    if (param === 'value') {
      args.value = value;
    } else if (param === 'age') {
      args.age = state.userProfile.age;
    } else if (param === 'bodyweight') {
      args.bodyweight = state.userProfile.weight;
    } else if (param === 'gender') {
      args.gender = state.userProfile.gender;
    }
  });

  try {
    return func(args);
  } catch (error) {
    console.error(`Error calculating percentile for ${metricName}:`, error);
    return null;
  }
}
