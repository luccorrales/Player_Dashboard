import { supabase } from '../config/supabase.js';
import { state } from '../state/state.js';

export async function loadWeights() {
  const { data } = await supabase
    .from("category_weights")
    .select("*");

  if (data && data.length > 0) {
    data.forEach(w => {
      state.currentWeights[w.category_path] = w.weight;
    });
  }
}

export async function saveWeights() {
  const weightsToSave = [];
  const inputs = document.querySelectorAll('[id^="weight_"]');
  
  inputs.forEach(input => {
    const path = input.id.replace('weight_', '').replaceAll('__', '.');
    const weight = parseFloat(input.value) || 5;
    weightsToSave.push({
      category_path: path,
      weight: weight
    });
    state.currentWeights[path] = weight;
  });

  await supabase.from("category_weights").delete().neq('category_path', '');
  
  const { error } = await supabase
    .from("category_weights")
    .insert(weightsToSave);

  if (error) {
    console.error(error);
    alert("Failed to save weights");
    return;
  }

  document.getElementById("status").textContent = "✅ Weights saved!";
}

export async function loadGoals() {
  const { data } = await supabase
    .from("category_goals")
    .select("*");

  if (data && data.length > 0) {
    data.forEach(g => {
      state.currentGoals[g.category_path] = g.target_percentile;
    });
  }
}

export async function saveGoals() {
  const goalsToSave = [];
  const inputs = document.querySelectorAll('[id^="goal_"]');
  
  inputs.forEach(input => {
    const path = input.id.replace('goal_', '').replaceAll('__', '.');
    const targetPercentile = parseFloat(input.value);
    
    if (!isNaN(targetPercentile) && targetPercentile > 0) {
      goalsToSave.push({
        category_path: path,
        target_percentile: targetPercentile
      });
      state.currentGoals[path] = targetPercentile;
    }
  });

  await supabase.from("category_goals").delete().neq('category_path', '');
  
  if (goalsToSave.length > 0) {
    const { error } = await supabase
      .from("category_goals")
      .insert(goalsToSave);

    if (error) {
      console.error(error);
      alert("Failed to save goals");
      return;
    }
  }

  document.getElementById("status").textContent = "✅ Goals saved!";
}
