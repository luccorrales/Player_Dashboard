// ===================================
// CONFIGURATION
// ===================================
const SUPABASE_URL = "https://sugekxazhhxmbzncqxyg.supabase.co";
const SUPABASE_KEY = "sb_publishable_84h5tEu4ALMHkJWBxQeYdw_WqSSJiKd";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===================================
// DATA DEFINITIONS
// ===================================
const CATEGORIES = {
  physical: {
    name: "Physical",
    icon: "💪",
    subStats: ["Strength", "Cardio", "Flexibility", "Coordination", "Recovery"]
  },
  cognitive: {
    name: "Cognitive",
    icon: "🧠",
    subStats: ["Logical Reasoning", "Verbal Ability", "Memory", "Processing Speed", "Creativity"]
  },
  social: {
    name: "Social",
    icon: "🗣️",
    subStats: ["Charisma", "Active Listening", "Public Speaking", "Networking", "Conflict Resolution"]
  },
  relational: {
    name: "Relational",
    icon: "❤️",
    subStats: ["Relationship Quality", "Network Size", "Social Support", "Emotional Intimacy"]
  },
  financial: {
    name: "Financial",
    icon: "💰",
    subStats: ["Income", "Net Worth", "Financial Literacy", "Savings Rate", "Investment Knowledge"]
  },
  emotional: {
    name: "Emotional",
    icon: "😌",
    subStats: ["Resilience", "Emotional Intelligence", "Stress Management", "Self-Awareness"]
  },
  skills: {
    name: "Skills",
    icon: "🎯",
    subStats: ["Professional Skills", "Technical Abilities", "Creative Skills", "Practical Knowledge"]
  }
};

const ACHIEVEMENTS = [
  { id: 1, title: "First Steps", icon: "🎯", condition: "entries >= 1", unlocked: false },
  { id: 2, title: "Consistent Tracker", icon: "📅", condition: "entries >= 10", unlocked: false },
  { id: 3, title: "Physical Elite", icon: "🏋️", condition: "physical >= 80", unlocked: false },
  { id: 4, title: "Mental Giant", icon: "🧠", condition: "cognitive >= 80", unlocked: false },
  { id: 5, title: "Social Butterfly", icon: "🦋", condition: "social >= 80", unlocked: false },
  { id: 6, title: "Wealthy Mind", icon: "💎", condition: "financial >= 80", unlocked: false },
  { id: 7, title: "Well-Rounded", icon: "⭐", condition: "all_above_50", unlocked: false },
  { id: 8, title: "Peak Performance", icon: "🏆", condition: "any_above_90", unlocked: false }
];

// ===================================
// STATE MANAGEMENT
// ===================================
let historyChart = null;
let projectionChart = null;
let currentWeights = {};

// ===================================
// INITIALIZATION
// ===================================
async function init() {
  updateStatus("✅ Connected to Supabase", "success");
  
  // Setup event listeners
  setupEventListeners(); // <--- THIS MUST EXECUTE FOR TABS TO WORK
  
  // Populate form dropdowns
  populateCategorySelect();
  
  // Load all data (Temporarily comment these out)
  // await loadDashboard();
  // await loadHistory();
  // await loadAchievements();
  // await loadProjections();
  // await loadWeights(); 
}

function setupEventListeners() {
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabName = e.target.dataset.tab;
      switchTab(tabName);
    });
  });

  // Form submissions
  document.getElementById('statForm').addEventListener('submit', handleStatFormSubmit);
  document.getElementById('weightsForm').addEventListener('submit', handleWeightsFormSubmit);
  
  // Category change
  document.getElementById('categorySelect').addEventListener('change', updateSubStats);
}

function updateStatus(message, type = "") {
  const statusEl = document.getElementById("status");
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

// ===================================
// UI - TAB SWITCHING
// ===================================
function switchTab(tabName) {
  // Hide all content
  document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  
  // Show selected content
  document.getElementById(tabName).classList.add('active');
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

// ===================================
// UI - FORM POPULATION
// ===================================
function populateCategorySelect() {
  const select = document.getElementById("categorySelect");
  Object.keys(CATEGORIES).forEach(key => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = CATEGORIES[key].name;
    select.appendChild(option);
  });
}

function updateSubStats() {
  const category = document.getElementById("categorySelect").value;
  const subSelect = document.getElementById("subStatSelect");
  subSelect.innerHTML = '<option value="">Select Sub-Stat...</option>';
  
  if (category && CATEGORIES[category]) {
    CATEGORIES[category].subStats.forEach(sub => {
      const option = document.createElement("option");
      option.value = sub;
      option.textContent = sub;
      subSelect.appendChild(option);
    });
  }
}

// ===================================
// DATABASE - STAT ENTRIES
// ===================================
async function handleStatFormSubmit(e) {
  e.preventDefault();
  
  const category = document.getElementById("categorySelect").value;
  const subStat = document.getElementById("subStatSelect").value;
  const value = document.getElementById("valueInput").value;
  const percentile = document.getElementById("percentileInput").value;
  const comparisonGroup = document.getElementById("comparisonGroup").value;
  const notes = document.getElementById("notesInput").value;

  if (!category || !subStat || !percentile) {
    updateStatus("❌ Please fill in required fields", "error");
    return;
  }

  const { error } = await supabase.from("stat_entries").insert([{
    category,
    sub_stat: subStat,
    value: parseFloat(value) || null,
    percentile: parseFloat(percentile),
    comparison_group: comparisonGroup,
    notes
  }]);

  if (error) {
    console.error(error);
    updateStatus("❌ Failed to add entry", "error");
    return;
  }

  updateStatus("✅ Entry added successfully!", "success");
  
  // Reset form
  document.getElementById("statForm").reset();
  
  // Reload data
  await loadDashboard();
  await loadHistory();
  await checkAchievements();
}

// ===================================
// DASHBOARD - MAIN VIEW
// ===================================
async function loadDashboard() {
  const { data, error } = await supabase
    .from("stat_entries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    updateStatus("❌ Failed to load dashboard", "error");
    return;
  }

  // Calculate latest percentiles per category
  const categoryStats = {};
  
  Object.keys(CATEGORIES).forEach(key => {
    const catEntries = data.filter(d => d.category === key);
    if (catEntries.length > 0) {
      const latestPercentile = catEntries[0].percentile;
      const previousPercentile = catEntries[1]?.percentile || latestPercentile;
      
      let trend = "stable";
      if (latestPercentile > previousPercentile) trend = "up";
      if (latestPercentile < previousPercentile) trend = "down";
      
      categoryStats[key] = {
        percentile: latestPercentile,
        trend,
        subStats: {}
      };

      // Get latest for each sub-stat
      CATEGORIES[key].subStats.forEach(sub => {
        const subEntries = catEntries.filter(d => d.sub_stat === sub);
        if (subEntries.length > 0) {
          categoryStats[key].subStats[sub] = subEntries[0].percentile;
        }
      });
    }
  });

  // Render stat cards
  renderStatsGrid(categoryStats);
  
  // Calculate weighted overall score
  calculateOverallScore(categoryStats);

  // Check for warnings
  checkWarnings(categoryStats, data);
}

function renderStatsGrid(categoryStats) {
  const grid = document.getElementById("statsGrid");
  grid.innerHTML = "";

  Object.keys(CATEGORIES).forEach(key => {
    const cat = CATEGORIES[key];
    const stats = categoryStats[key];
    
    if (stats) {
      const card = document.createElement("div");
      card.className = "stat-card";
      
      const trendSymbol = stats.trend === "up" ? "↑" : 
                         stats.trend === "down" ? "↓" : "→";
      
      let subStatsHTML = "";
      Object.keys(stats.subStats).forEach(sub => {
        subStatsHTML += `
          <div class="sub-stat">
            <span>${sub}</span>
            <span><strong>${stats.subStats[sub]}%</strong></span>
          </div>
        `;
      });

      card.innerHTML = `
        <div class="stat-header">
          <div class="stat-title">${cat.name}</div>
          <div class="stat-icon">${cat.icon}</div>
        </div>
        <div class="percentile">${stats.percentile}%</div>
        <div class="trend ${stats.trend}">${trendSymbol} ${stats.trend}</div>
        <div class="sub-stats">${subStatsHTML}</div>
      `;
      
      grid.appendChild(card);
    }
  });
}

// ===================================
// CALCULATIONS - OVERALL SCORE
// ===================================
function calculateOverallScore(categoryStats) {
  let totalWeighted = 0;
  let totalWeight = 0;

  Object.keys(categoryStats).forEach(key => {
    const weight = currentWeights[key] || 5;
    totalWeighted += categoryStats[key].percentile * weight;
    totalWeight += weight;
  });

  const overallScore = totalWeight > 0 ? Math.round(totalWeighted / totalWeight) : 0;
  document.getElementById("overallScore").textContent = overallScore;
}

// ===================================
// WARNING SYSTEM
// ===================================
function checkWarnings(categoryStats, allData) {
  const warningsDiv = document.getElementById("warnings");
  warningsDiv.innerHTML = "";

  Object.keys(categoryStats).forEach(key => {
    const catEntries = allData.filter(d => d.category === key).slice(0, 2);
    if (catEntries.length === 2) {
      const drop = catEntries[1].percentile - catEntries[0].percentile;
      if (drop >= 15) {
        const warning = document.createElement("div");
        warning.className = "warning";
        warning.innerHTML = `
          <strong>⚠️ Warning:</strong> ${CATEGORIES[key].name} dropped ${Math.round(drop)} percentile points recently!
        `;
        warningsDiv.appendChild(warning);
      }
    }
  });
}

// ===================================
// HISTORY CHART
// ===================================
async function loadHistory() {
  const { data, error } = await supabase
    .from("stat_entries")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  const ctx = document.getElementById("historyChart");
  if (historyChart) historyChart.destroy();

  // Prepare datasets for each category
  const datasets = {};
  const colors = [
    '#667eea', '#f56565', '#48bb78', '#ed8936', 
    '#9f7aea', '#38b2ac', '#ecc94b'
  ];
  
  Object.keys(CATEGORIES).forEach((key, index) => {
    datasets[key] = {
      label: CATEGORIES[key].name,
      data: [],
      borderColor: colors[index],
      backgroundColor: colors[index] + '20',
      tension: 0.3,
      fill: false
    };
  });

  // Group data by date
  const dateMap = new Map();
  data.forEach(entry => {
    const date = new Date(entry.created_at).toLocaleDateString();
    if (!dateMap.has(date)) {
      dateMap.set(date, {});
    }
    dateMap.get(date)[entry.category] = entry.percentile;
  });

  const labels = Array.from(dateMap.keys());
  
  // Fill datasets
  labels.forEach(date => {
    const dayData = dateMap.get(date);
    Object.keys(datasets).forEach(key => {
      datasets[key].data.push(dayData[key] || null);
    });
  });

  historyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: Object.values(datasets).filter(d => d.data.some(v => v !== null))
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        title: {
          display: true,
          text: "Percentile Progress Over Time",
          font: { size: 16, weight: 'bold' }
        },
        legend: {
          display: true,
          position: 'bottom'
        }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          title: { display: true, text: "Percentile" }
        },
        x: {
          title: { display: true, text: "Date" }
        }
      }
    }
  });
}

// ===================================
// ACHIEVEMENTS SYSTEM
// ===================================
async function loadAchievements() {
  const { data, error } = await supabase.from("stat_entries").select("*");
  if (error) return;

  // Calculate category averages from latest entries
  const categoryAvgs = {};
  Object.keys(CATEGORIES).forEach(key => {
    const catEntries = data.filter(d => d.category === key);
    if (catEntries.length > 0) {
      categoryAvgs[key] = catEntries[0].percentile;
    }
  });

  // Check achievement conditions
  ACHIEVEMENTS.forEach(ach => {
    if (ach.condition === "entries >= 1") {
      ach.unlocked = data.length >= 1;
    } else if (ach.condition === "entries >= 10") {
      ach.unlocked = data.length >= 10;
    } else if (ach.condition.includes(">=")) {
      const [cat, val] = ach.condition.split(" >= ");
      ach.unlocked = categoryAvgs[cat] >= parseInt(val);
    } else if (ach.condition === "all_above_50") {
      ach.unlocked = Object.values(categoryAvgs).length >= 7 && 
                     Object.values(categoryAvgs).every(v => v >= 50);
    } else if (ach.condition === "any_above_90") {
      ach.unlocked = Object.values(categoryAvgs).some(v => v >= 90);
    }
  });

  renderAchievements();
}

function renderAchievements() {
  const list = document.getElementById("achievementsList");
  list.innerHTML = "";
  
  ACHIEVEMENTS.forEach(ach => {
    const div = document.createElement("div");
    div.className = `achievement ${ach.unlocked ? "unlocked" : ""}`;
    div.innerHTML = `
      <div class="achievement-icon">${ach.icon}</div>
      <strong>${ach.title}</strong>
      <p>${ach.unlocked ? "✅ Unlocked!" : "🔒 Locked"}</p>
    `;
    list.appendChild(div);
  });
}

async function checkAchievements() {
  await loadAchievements();
}

// ===================================
// PROJECTIONS
// ===================================
async function loadProjections() {
  const { data, error } = await supabase
    .from("stat_entries")
    .select("*")
    .order("created_at", { ascending: true });

  if (error || data.length < 2) return;

  const ctx = document.getElementById("projectionChart");
  if (projectionChart) projectionChart.destroy();

  // Calculate linear projections for each category
  const projections = {};
  Object.keys(CATEGORIES).forEach(key => {
    const catData = data.filter(d => d.category === key);
    if (catData.length >= 2) {
      const first = catData[0];
      const last = catData[catData.length - 1];
      const timeSpan = (new Date(last.created_at) - new Date(first.created_at)) / (1000 * 60 * 60 * 24 * 365);
      
      if (timeSpan > 0) {
        const growth = (last.percentile - first.percentile) / timeSpan;
        
        projections[key] = {
          current: last.percentile,
          in5years: Math.min(100, Math.max(0, last.percentile + growth * 5)),
          in10years: Math.min(100, Math.max(0, last.percentile + growth * 10))
        };
      }
    }
  });

  if (Object.keys(projections).length === 0) return;

  const labels = ["Current", "5 Years", "10 Years"];
  const colors = [
    '#667eea', '#f56565', '#48bb78', '#ed8936', 
    '#9f7aea', '#38b2ac', '#ecc94b'
  ];
  
  const datasets = Object.keys(projections).map((key, index) => ({
    label: CATEGORIES[key].name,
    data: [
      projections[key].current,
      projections[key].in5years,
      projections[key].in10years
    ],
    borderColor: colors[index],
    backgroundColor: colors[index] + '20',
    tension: 0.3
  }));

  projectionChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        title: {
          display: true,
          text: "Future Projections Based on Current Trends",
          font: { size: 16, weight: 'bold' }
        },
        legend: {
          display: true,
          position: 'bottom'
        }
      },
      scales: {
        y: { min: 0, max: 100, title: { display: true, text: "Percentile" } }
      }
    }
  });

  // Generate insights
  renderProjectionInsights(projections);
}

function renderProjectionInsights(projections) {
  const insights = document.getElementById("projectionInsights");
  insights.innerHTML = "<h3>Projection Insights</h3>";
  
  Object.keys(projections).forEach(key => {
    const proj = projections[key];
    const change5 = proj.in5years - proj.current;
    const div = document.createElement("p");
    div.innerHTML = `<strong>${CATEGORIES[key].name}:</strong> 
      ${change5 > 0 ? "📈" : "📉"} Expected ${Math.abs(change5).toFixed(1)} percentile 
      ${change5 > 0 ? "increase" : "decrease"} in 5 years`;
    insights.appendChild(div);
  });
}

// ===================================
// WEIGHTS SYSTEM
// ===================================
async function loadWeights() {
  const { data, error } = await supabase
    .from("category_weights")
    .select("*")
    .single();

  if (data && data.weights) {
    currentWeights = data.weights;
  } else {
    // Set default weights
    Object.keys(CATEGORIES).forEach(key => {
      currentWeights[key] = 5;
    });
  }

  renderWeightsForm();
}

function renderWeightsForm() {
  const formContent = document.getElementById("weightsFormContent");
  formContent.innerHTML = "";
  
  Object.keys(CATEGORIES).forEach(key => {
    const weight = currentWeights[key] || 5;
    const div = document.createElement("div");
    div.className = "form-group";
    div.innerHTML = `
      <label>${CATEGORIES[key].icon} ${CATEGORIES[key].name}</label>
      <div style="display: flex; align-items: center;">
        <input type="range" id="weight_${key}" min="1" max="10" value="${weight}" 
               oninput="document.getElementById('weight_${key}_val').textContent = this.value">
        <span id="weight_${key}_val" style="margin-left: 10px; font-weight: bold; min-width: 30px;">${weight}</span>
      </div>
    `;
    formContent.appendChild(div);
  });
}

async function handleWeightsFormSubmit(e) {
  e.preventDefault();
  
  const weights = {};
  Object.keys(CATEGORIES).forEach(key => {
    weights[key] = parseInt(document.getElementById(`weight_${key}`).value);
  });

  const { error } = await supabase
    .from("category_weights")
    .upsert({ id: 1, weights });

  if (error) {
    console.error(error);
    updateStatus("❌ Failed to save weights", "error");
    return;
  }

  currentWeights = weights;
  updateStatus("✅ Weights saved successfully!", "success");
  await loadDashboard();
}

// ===================================
// START APPLICATION
// ===================================
document.addEventListener('DOMContentLoaded', init);
