# Life Stats Dashboard - Implementation Guide

## 📁 File Structure

```
life-stats-dashboard/
├── index.html                          ✅ Main application file
├── js/
│   └── percentile/
│       ├── index.js                    ✅ Helper functions & registry
│       ├── percentile-physical.js      ✅ Physical metrics
│       ├── percentile-cognitive.js     ✅ Cognitive metrics
│       ├── percentile-financial.js     ✅ Financial metrics
│       ├── percentile-social.js        ✅ Social metrics
│       └── percentile-emotional.js     ✅ Emotional metrics
└── README.md
```

---

## 🗄️ Updated Supabase Schema

Run this SQL in your Supabase SQL Editor:

```sql
-- 1. DROP OLD TABLES
DROP TABLE IF EXISTS stat_entries CASCADE;
DROP TABLE IF EXISTS metric_values CASCADE;
DROP TABLE IF EXISTS metric_definitions CASCADE;
DROP TABLE IF EXISTS user_profile CASCADE;

-- 2. CATEGORY STRUCTURE
CREATE TABLE IF NOT EXISTS category_structure (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '',
  parent_path TEXT REFERENCES category_structure(path) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. METRIC DEFINITIONS
CREATE TABLE metric_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_path TEXT NOT NULL REFERENCES category_structure(path) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  percentile_function TEXT,
  parameters JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_path, metric_name)
);

-- 4. METRIC VALUES
CREATE TABLE metric_values (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_path TEXT NOT NULL REFERENCES category_structure(path) ON DELETE CASCADE,
  metric_id UUID REFERENCES metric_definitions(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  value DECIMAL NOT NULL,
  percentile INTEGER,
  comparison_group TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. USER PROFILE (UPDATED - ADDED WEIGHT)
CREATE TABLE user_profile (
  id INTEGER PRIMARY KEY DEFAULT 1,
  age INTEGER,
  gender TEXT,
  weight DECIMAL,
  location TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- 6. CATEGORY WEIGHTS
CREATE TABLE IF NOT EXISTS category_weights (
  id INTEGER PRIMARY KEY DEFAULT 1,
  weights JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row_weights CHECK (id = 1)
);

-- 7. INSERT DEFAULTS
INSERT INTO user_profile (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO category_weights (id, weights) 
VALUES (1, '{"physical": 5, "cognitive": 5, "social": 5, "financial": 5, "emotional": 5}')
ON CONFLICT (id) DO NOTHING;

-- 8. ENABLE RLS
ALTER TABLE category_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_weights ENABLE ROW LEVEL SECURITY;

-- 9. CREATE POLICIES
CREATE POLICY "Allow all" ON category_structure FOR ALL USING (true);
CREATE POLICY "Allow all" ON metric_definitions FOR ALL USING (true);
CREATE POLICY "Allow all" ON metric_values FOR ALL USING (true);
CREATE POLICY "Allow all" ON user_profile FOR ALL USING (true);
CREATE POLICY "Allow all" ON category_weights FOR ALL USING (true);

-- 10. CREATE INDEXES
CREATE INDEX idx_metric_definitions_category ON metric_definitions(category_path);
CREATE INDEX idx_metric_values_category ON metric_values(category_path);
CREATE INDEX idx_metric_values_metric_id ON metric_values(metric_id);
CREATE INDEX idx_metric_values_created_at ON metric_values(created_at DESC);
```

---

## ✨ What Changed - Summary

### 1. **Weight Added to Personal Info** ✅
- Settings tab now has weight input field
- Used in bodyweight-ratio calculations (bench press, squat, etc.)
- Stored in `user_profile.weight`

### 2. **Default Emoji is Empty** ✅
- Icon field now defaults to empty string `""`
- Categories without icons display cleanly without emoji
- Label changed to "Icon (emoji, optional)"

### 3. **Edit Categories** ✅
- New "Edit" button next to each category in Manage tab
- Opens modal with existing data pre-filled
- Can edit name, icon, and metrics
- Can add/remove metrics without losing data
- Updates instead of recreates

### 4. **Only Show Categories with Metrics in Add Data** ✅
- Category Path dropdown filters to only show categories that have metrics defined
- Prevents confusion from empty categories
- Makes input workflow cleaner

### 5. **Modular Percentile Functions** ✅
All percentile functions now in separate files by category:

**js/percentile/index.js**
- Helper functions (`calculatePercentileFromBenchmarks`, `cumulativeNormalDistribution`)
- Creates global `percentileFunctions` object

**js/percentile/percentile-physical.js** (11 functions)
- `bench_press_percentile`, `squat_percentile`, `deadlift_percentile`
- `run_5k_percentile`, `run_10k_percentile`, `marathon_percentile`
- `vo2max_percentile`, `bodyfat_percentile`, `flexibility_percentile`
- `pushups_percentile`, `pullups_percentile`

**js/percentile/percentile-cognitive.js** (15 functions)
- `iq_percentile`, `sat_percentile`, `act_percentile`
- `reading_speed_percentile`, `typing_speed_percentile`
- `memory_span_percentile`, `reaction_time_percentile`
- `chess_rating_percentile`, etc.

**js/percentile/percentile-financial.js** (13 functions)
- `networth_percentile`, `income_percentile`, `savings_rate_percentile`
- `credit_score_percentile`, `investment_return_percentile`
- `retirement_savings_percentile`, etc.

**js/percentile/percentile-social.js** (15 functions)
- `close_friends_percentile`, `network_size_percentile`
- `public_speaking_percentile`, `social_media_percentile`
- `empathy_percentile`, `languages_spoken_percentile`, etc.

**js/percentile/percentile-emotional.js** (20 functions)
- `emotional_intelligence_percentile`, `stress_management_percentile`
- `resilience_percentile`, `meditation_percentile`
- `anxiety_percentile`, `depression_percentile`
- `life_satisfaction_percentile`, etc.

---

## 🎯 How to Add New Percentile Functions

### Example: Adding a new "Career" category

**Step 1:** Create `js/percentile/percentile-career.js`

```javascript
// Career category percentile functions

// Job Satisfaction Score (0-100)
percentileFunctions.job_satisfaction_percentile = (score) => {
  const benchmarks = [0, 30, 45, 55, 65, 75, 85, 95, 100];
  return calculatePercentileFromBenchmarks(score, benchmarks);
};

// Years of Experience
percentileFunctions.years_experience_percentile = (years, age) => {
  // Career typically starts at 22, so adjust for age
  const expectedYears = Math.max(0, age - 22);
  const ratio = years / expectedYears;
  const benchmarks = [0, 0.5, 0.7, 0.85, 1.0, 1.1, 1.2];
  return calculatePercentileFromBenchmarks(ratio, benchmarks);
};

// Promotions Received
percentileFunctions.promotions_percentile = (promotionCount, yearsWorked) => {
  // Average is 1 promotion every 3-5 years
  const rate = promotionCount / (yearsWorked / 4);
  const benchmarks = [0, 0.5, 0.8, 1.0, 1.5, 2.0, 3.0];
  return calculatePercentileFromBenchmarks(rate, benchmarks);
};
```

**Step 2:** Add script tag to `index.html` (before closing `</body>`)

```html
<script src="js/percentile/percentile-career.js"></script>
```

**Step 3:** Update `getPercentileFunctionOptions()` in index.html

```javascript
const functions = [
  // ... existing functions ...
  { value: 'job_satisfaction_percentile', label: 'Job Satisfaction', category: 'career' },
  { value: 'years_experience_percentile', label: 'Years Experience', category: 'career' },
  { value: 'promotions_percentile', label: 'Promotions', category: 'career' }
];
```

**Step 4:** Update `getParametersForFunction()` in index.html

```javascript
const paramMap = {
  // ... existing mappings ...
  job_satisfaction_percentile: ["value"],
  years_experience_percentile: ["years", "age"],
  promotions_percentile: ["promotionCount", "yearsWorked"]
};
```

**Done!** Your new functions are now available in the dropdown when creating metrics.

---

## 🔧 Function Parameter Types

When creating functions, these parameters are automatically available:

- `value` - The raw metric value entered by user
- `age` - From user profile
- `gender` - From user profile  
- `weight` / `bodyweight` - From user profile
- Custom parameters - Must be other metrics in the same category

---

## 📝 Best Practices for Percentile Functions

### 1. **Use Realistic Benchmarks**
```javascript
// ❌ Bad: Arbitrary numbers
const benchmarks = [10, 20, 30, 40, 50];

// ✅ Good: Research-based benchmarks
const benchmarks = [0, 25000, 40000, 60000, 85000]; // Based on US Census data
```

### 2. **Handle Edge Cases**
```javascript
// Always handle missing parameters
percentileFunctions.example_percentile = (value, age) => {
  if (!age) age = 30; // Default fallback
  // ... rest of function
};
```

### 3. **Invert When "Lower is Better"**
```javascript
// For metrics like run times, debt ratios, anxiety scores
const percentile = 100 - calculatePercentileFromBenchmarks(value, benchmarks);
return Math.max(0, Math.min(100, percentile));
```

### 4. **Age-Adjust When Relevant**
```javascript
const ageFactor = age < 30 ? 1.0 : age < 40 ? 0.95 : age < 50 ? 0.9 : 0.85;
const adjusted = benchmarks.map(b => b * ageFactor);
```

### 5. **Use Normal Distribution for Psychological Tests**
```javascript
const mean = 100;
const sd = 15;
const z = (value - mean) / sd;
return Math.round(cumulativeNormalDistribution(z) * 100);
```

---

## 🚀 Deployment

### Option 1: Local
1. Open `index.html` in browser
2. Works immediately (all files local)

### Option 2: GitHub Pages
1. Push all files to GitHub repo
2. Enable Pages in Settings
3. Access at `https://username.github.io/repo-name`

### Option 3: Netlify
1. Drag folder to netlify.com/drop
2. OR connect GitHub repo for auto-deploy

**Important:** Maintain the folder structure! The JS files must be in `js/percentile/` for imports to work.

---

## 🎨 Available Percentile Functions

### Physical (11)
- bench_press, squat, deadlift, strength_ratio
- run_5k, run_10k, marathon
- vo2max, bodyfat, flexibility
- pushups, pullups

### Cognitive (15)
- iq, sat, act, gre_verbal, gre_quant
- reading_speed, typing_speed
- memory_span, reaction_time, working_memory
- processing_speed, verbal_fluency
- chess_rating, language_proficiency, math_speed

### Financial (13)
- networth, income, savings_rate
- credit_score, investment_return, emergency_fund
- debt_to_income, retirement_savings
- diversification, passive_income
- financial_literacy, years_to_fi, home_equity

### Social (15)
- close_friends, network_size, social_events
- public_speaking, social_media, volunteer_hours
- response_time, networking_events
- professional_connections, conflict_resolution
- active_listening, empathy, languages_spoken
- mentoring, leadership_roles, charisma

### Emotional (20)
- emotional_intelligence, stress_management, resilience
- meditation, sleep_quality, sleep_hours
- anxiety, depression, life_satisfaction
- positive_affect, gratitude, self_awareness
- emotional_regulation, therapy_sessions
- burnout, work_life_balance, social_support
- mindfulness, emotional_vocabulary, optimism

---

## 💡 Tips

- **Start simple:** Add 1-2 metrics per category, expand later
- **Test functions:** Add test data to verify percentiles are reasonable
- **Document benchmarks:** Add comments explaining where benchmarks come from
- **Consider context:** Age, gender, and location adjustments make percentiles more meaningful
- **Backup data:** Export from Supabase regularly

---

## 🐛 Troubleshooting

**Functions not working?**
- Check browser console for errors
- Verify script load order in HTML
- Ensure function name matches exactly in dropdown

**Percentiles seem wrong?**
- Review benchmark values
- Check if function needs to be inverted
- Verify age/gender adjustments

**Category not showing in Add Data?**
- Ensure category has at least one metric defined
- Check that metric has valid name and unit

---

Happy tracking! 📊🎮
