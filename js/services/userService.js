import { supabase } from '../config/supabase.js';
import { state } from '../state/state.js';

export async function loadPersonalInfo() {
  const { data } = await supabase
    .from("user_profile")
    .select("*")
    .single();

  if (data) {
    state.userProfile = data;
    document.getElementById("userAge").value = data.age || "";
    document.getElementById("userGender").value = data.gender || "";
    document.getElementById("userWeight").value = data.weight || "";
    document.getElementById("userLocation").value = data.location || "";
  }
}

export async function savePersonalInfo() {
  const age = parseInt(document.getElementById("userAge").value);
  const gender = document.getElementById("userGender").value;
  const weight = parseFloat(document.getElementById("userWeight").value);
  const location = document.getElementById("userLocation").value;

  const { error } = await supabase
    .from("user_profile")
    .upsert({
      id: 1,
      age,
      gender,
      weight,
      location,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error(error);
    alert("Failed to save personal info");
    return;
  }

  state.userProfile = { age, gender, weight, location };
  document.getElementById("status").textContent = "✅ Personal info saved!";
}
