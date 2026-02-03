import { supabase } from '../config/supabase.js';
import { state } from '../state/state.js';

export async function loadCategoryStructure(doPopulate = true) {
  const { data, error } = await supabase
    .from("category_structure")
    .select("*")
    .order("path", { ascending: true });

  if (error || !data || data.length === 0) {
    await initializeDefaultStructure();
    const { data: newData } = await supabase
      .from("category_structure")
      .select("*")
      .order("path", { ascending: true });

    if (!newData || newData.length === 0) return false;
    state.categoryStructure = newData;
    return true;
  }

  state.categoryStructure = data;
  return true;
}

export async function loadMetricDefinitions() {
  const { data } = await supabase
    .from("metric_definitions")
    .select("*");

  if (data) {
    state.metricDefinitions = data;
  }
}

export async function initializeDefaultStructure() {
  const defaults = [
    { path: "physical", name: "Physical", icon: "💪", parent_path: null },
    { path: "physical.strength", name: "Strength", icon: "🏋️", parent_path: "physical" },
    { path: "cognitive", name: "Cognitive", icon: "🧠", parent_path: null },
    { path: "social", name: "Social", icon: "🗣️", parent_path: null },
    { path: "financial", name: "Financial", icon: "💰", parent_path: null },
    { path: "financial.networth", name: "Net Worth", icon: "💎", parent_path: "financial" },
    { path: "emotional", name: "Emotional", icon: "😌", parent_path: null }
  ];

  await supabase.from("category_structure").insert(defaults);

  const defaultMetrics = [
    { category_path: "financial.networth", metric_name: "Net Worth", unit: "USD", percentile_function: "networth_percentile", parameters: ["value", "age"] },
    { category_path: "physical.strength", metric_name: "Bench Press", unit: "lbs", percentile_function: "bench_press_percentile", parameters: ["oneRM", "age", "bodyweight"] }
  ];

  await supabase.from("metric_definitions").insert(defaultMetrics);
}

export function getTopLevelCategories() {
  return state.categoryStructure.filter(c => !c.parent_path);
}

export function getChildren(path) {
  return state.categoryStructure.filter(c => c.parent_path === path);
}

export function buildCategoryTree(parentPath = null, level = 0) {
  const categories = parentPath === null ? getTopLevelCategories() : getChildren(parentPath);
  return categories.map(cat => ({
    ...cat,
    level,
    children: buildCategoryTree(cat.path, level + 1)
  }));
}

export async function saveCategory(categoryData, isEdit = false, originalPath = null) {
  if (isEdit && originalPath) {
    const { error } = await supabase
      .from("category_structure")
      .update(categoryData)
      .eq("path", originalPath);
    
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("category_structure")
      .insert([categoryData]);
    
    if (error) throw error;
  }
  
  await loadCategoryStructure(false);
}

export async function deleteCategory(path) {
  const { error } = await supabase
    .from("category_structure")
    .delete()
    .eq("path", path);
  
  if (error) throw error;
  
  await loadCategoryStructure(false);
}
