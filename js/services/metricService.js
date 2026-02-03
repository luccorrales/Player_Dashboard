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
    
    const entry = {
      category_path: categoryPath,
      metric_name: metric.name,
      value: metric.value,
      // Ensure the percentile is rounded before sending to Supabase
      percentile: percentile !== null ? Math.round(percentile) : null, 
      comparison_group: comparisonGroup,
      created_at: new Date().toISOString()
    };
    
    // Add raw inputs if they exist (for strength metrics)
    if (metric.raw_input_1 !== undefined && metric.raw_input_2 !== undefined) {
      entry.raw_input_1 = metric.raw_input_1;
      entry.raw_input_2 = metric.raw_input_2;
    }
    
    entries.push(entry);
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
    console.warn(`No percentile function defined for metric: ${metricName}`);
    return null;
  }

  const funcName = metricDef.percentile_function;
  const func = percentileFunctions[funcName];

  if (!func) {
    console.warn(`Percentile function "${funcName}" not found`);
    return null;
  }

  // Build argument array based on parameter order
  const args = [];
  
  metricDef.parameters.forEach(param => {
    // Handle all variations of the "value" parameter
    if (param === 'value' || param === 'oneRM' || param === 'weight') {
      args.push(value);
    } else if (param === 'age') {
      args.push(state.userProfile.age || 30);
    } else if (param === 'bodyweight') {
      args.push(state.userProfile.weight || 180);
    } else if (param === 'gender') {
      args.push(state.userProfile.gender || 'male');
    } else if (param === 'minutes') {
      args.push(value);
    } else {
      // For any unknown parameter, default to null
      console.warn(`Unknown parameter: ${param}`);
      args.push(null);
    }
  });

  try {
    console.log(`Calculating percentile for ${metricName}:`, {
      function: funcName,
      parameters: metricDef.parameters,
      args: args
    });
    
    const result = func(...args); // Spread args as individual parameters
    console.log(`Result: ${result}`);
    return result;
  } catch (error) {
    console.error(`Error calculating percentile for ${metricName}:`, error);
    return null;
  }
}