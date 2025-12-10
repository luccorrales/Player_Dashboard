# 📘 Complete Guide: Adding Percentile Functions

This guide provides **step-by-step instructions** for adding new percentile calculation functions to your Life Stats Dashboard.

---

## 🎯 Overview

Percentile functions automatically calculate where your metric value ranks compared to benchmarks (0-100th percentile). Functions are organized by category in separate files for easy maintenance.

---

## 📋 Prerequisites

Before adding functions, ensure you understand:
- **JavaScript basics** (functions, arrays, math)
- **Your metric benchmarks** (research data or standards)
- **File structure** of the `/js/percentile/` directory

---

## 🔧 Step-by-Step Process

### **Step 1: Choose or Create the Category File**

Percentile functions are organized by category. Choose the appropriate file:

| Category | File | Current Functions |
|----------|------|-------------------|
| Physical | `percentile-physical.js` | 11 functions |
| Cognitive | `percentile-cognitive.js` | 15 functions |
| Financial | `percentile-financial.js` | 13 functions |
| Social | `percentile-social.js` | 15 functions |
| Emotional | `percentile-emotional.js` | 20 functions |
| **New Category** | `percentile-YOURNAME.js` | Create new file |

**If creating a new category file:**

1. Create `/js/percentile/percentile-YOURCATEGORY.js`
2. Add script tag to `index.html` **before** the main `<script>` tag:
   ```html
   <script src="js/percentile/percentile-YOURCATEGORY.js"></script>
   ```

---

### **Step 2: Write Your Percentile Function**

Open the appropriate category file and add your function.

#### **Template:**

```javascript
// [Function Name] - [Brief Description]
percentileFunctions.your_function_name = (param1, param2, param3) => {
  // Your calculation logic here
  
  const benchmarks = [value1, value2, value3, value4, value5];
  return calculatePercentileFromBenchmarks(param1, benchmarks);
};
```

#### **Function Naming Convention:**
- Use `snake_case` (lowercase with underscores)
- Be descriptive: `bench_press_percentile` not `bp_perc`
- End with `_percentile`

---

### **Step 3: Define Parameters**

Parameters are values needed for the calculation:

#### **Available Parameters:**

| Parameter | Source | Description |
|-----------|--------|-------------|
| `value` | User input | The main metric value |
| `age` | User profile | User's age |
| `gender` | User profile | User's gender (`'male'`, `'female'`, `'other'`) |
| `weight` | User profile | User's weight (lbs or kg) |
| Custom params | Other metrics | Values from related metrics |

#### **Example 1: Simple (no adjustments)**
```javascript
// Income percentile - just needs the income value
percentileFunctions.income_percentile = (value) => {
  const benchmarks = [0, 25000, 40000, 60000, 85000, 120000, 180000];
  return calculatePercentileFromBenchmarks(value, benchmarks);
};
```

#### **Example 2: Age-adjusted**
```javascript
// Net worth percentile - adjusted by age
percentileFunctions.networth_percentile = (value, age) => {
  const ageGroup = Math.floor(age / 10) * 10;
  
  const benchmarks = {
    20: [0, 5000, 15000, 50000, 100000],
    30: [0, 20000, 50000, 150000, 300000],
    40: [0, 50000, 150000, 400000, 800000]
  };
  
  const bench = benchmarks[ageGroup] || benchmarks[30];
  return calculatePercentileFromBenchmarks(value, bench);
};
```

#### **Example 3: Multiple parameters**
```javascript
// Bench press percentile - weight, age, and bodyweight
percentileFunctions.bench_press_percentile = (weight, age, bodyweight) => {
  const ratio = weight / bodyweight;
  const ageFactor = age < 30 ? 1.0 : age < 40 ? 0.95 : 0.85;
  const adjustedRatio = ratio / ageFactor;
  
  const benchmarks = [0, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  return calculatePercentileFromBenchmarks(adjustedRatio, benchmarks);
};
```

---

### **Step 4: Set Up Benchmarks**

Benchmarks are reference values that define percentile ranges.

#### **Rules for Benchmarks:**
1. **Must be in ascending order** (lowest to highest)
2. **Include at least 5 values** for accuracy
3. **Should span the realistic range** (0th to 100th percentile)
4. **Based on research/data** when possible

#### **Example: Bad vs Good Benchmarks**

❌ **Bad:**
```javascript
const benchmarks = [10, 50, 100]; // Too few values, arbitrary
```

✅ **Good:**
```javascript
// Based on US Census income data
const benchmarks = [0, 25000, 40000, 60000, 85000, 120000, 180000, 300000];
```

#### **Where to Find Benchmarks:**
- 🔬 **Research papers** (Google Scholar)
- 📊 **Government statistics** (Census, CDC, BLS)
- 📚 **Standardized tests** (IQ, SAT, fitness tests)
- 🏋️ **Sports/fitness standards** (strength standards websites)
- 💰 **Financial data** (Vanguard, Fidelity reports)

---

### **Step 5: Handle "Lower is Better" Metrics**

Some metrics improve as values **decrease** (e.g., race times, anxiety scores, debt).

#### **Inversion Pattern:**

```javascript
percentileFunctions.run_5k_percentile = (minutes, age, gender) => {
  const isMale = gender === 'male';
  
  // Benchmarks from SLOW to FAST
  const benchmarks = isMale ? 
    [40, 30, 25, 22, 20, 18, 16] : 
    [45, 35, 30, 27, 24, 21, 19];
  
  // Calculate percentile (lower time = lower percentile initially)
  const percentile = calculatePercentileFromBenchmarks(minutes, benchmarks);
  
  // INVERT: lower time should = higher percentile
  return 100 - percentile;
};
```

**When to invert:**
- ⏱️ Times/durations (race times, reaction time)
- 📉 Negative metrics (anxiety, depression, debt)
- 💪 Effort scores (lower effort for same result = better)

---

### **Step 6: Add Function to Dropdown**

Edit `index.html` and find the `getPercentileFunctionOptions()` function (around line 1050).

Add your function to the array:

```javascript
function getPercentileFunctionOptions(selectedFunc = null) {
  const functions = [
    // ... existing functions ...
    
    // Add your new function here
    { 
      value: 'your_function_name', 
      label: 'Display Name for Dropdown', 
      category: 'physical' // or cognitive, financial, etc.
    },
  ];
  
  return functions.map(f => 
    `<option value="${f.value}" ${f.value === selectedFunc ? 'selected' : ''}>${f.label}</option>`
  ).join('');
}
```

**Example:**
```javascript
{ value: 'deadlift_percentile', label: 'Deadlift (weight/bodyweight)', category: 'physical' },
```

---

### **Step 7: Map Function Parameters**

Edit `index.html` and find the `getParametersForFunction()` function (around line 1080).

Add parameter mapping:

```javascript
function getParametersForFunction(funcName) {
  const paramMap = {
    // ... existing mappings ...
    
    your_function_name: ["value", "age", "gender"],
  };
  return paramMap[funcName] || ["value"];
}
```

**Parameter names MUST match exactly** with what your function expects.

**Examples:**
```javascript
income_percentile: ["value"],
networth_percentile: ["value", "age"],
bench_press_percentile: ["weight", "age", "bodyweight"],
run_5k_percentile: ["minutes", "age", "gender"],
```

---

### **Step 8: Test Your Function**

1. **Refresh the page** (Ctrl+F5 / Cmd+Shift+R)
2. **Go to Manage Categories**
3. **Create a test category** with your metric
4. **Select your new function** from the dropdown
5. **Go to Add Data**
6. **Enter test values** and verify percentile calculation

#### **Test Cases to Try:**
- ✅ Minimum value → Should be near 0th percentile
- ✅ Maximum value → Should be near 100th percentile
- ✅ Average value → Should be around 50th percentile
- ✅ Missing parameters → Should not crash (use defaults)

---

## 📚 Complete Examples

### **Example 1: Simple Metric (No Adjustments)**

**Scenario:** Track typing speed (WPM)

```javascript
// Typing Speed Percentile (words per minute)
percentileFunctions.typing_speed_percentile = (wpm) => {
  // Average typist: 40 WPM, Professional: 80+ WPM
  const benchmarks = [20, 30, 40, 50, 65, 80, 100, 120];
  return calculatePercentileFromBenchmarks(wpm, benchmarks);
};
```

**Dropdown entry:**
```javascript
{ value: 'typing_speed_percentile', label: 'Typing Speed (WPM)', category: 'cognitive' }
```

**Parameter mapping:**
```javascript
typing_speed_percentile: ["value"]
```

---

### **Example 2: Age-Adjusted Metric**

**Scenario:** Track push-ups in 1 minute

```javascript
// Push-ups in 1 Minute (age and gender adjusted)
percentileFunctions.pushups_percentile = (count, age, gender) => {
  const isMale = gender === 'male';
  
  // Age deterioration factor
  const ageFactor = age < 30 ? 1.0 : age < 40 ? 0.9 : age < 50 ? 0.8 : 0.7;
  
  // Base benchmarks (for age 25-30)
  const benchmarks = isMale ?
    [0, 10, 20, 30, 40, 50, 70] :
    [0, 5, 12, 20, 28, 36, 50];
  
  // Adjust benchmarks for age
  const adjusted = benchmarks.map(b => Math.round(b * ageFactor));
  
  return calculatePercentileFromBenchmarks(count, adjusted);
};
```

**Dropdown entry:**
```javascript
{ value: 'pushups_percentile', label: 'Push-ups (1 min)', category: 'physical' }
```

**Parameter mapping:**
```javascript
pushups_percentile: ["count", "age", "gender"]
```

---

### **Example 3: Inverted "Lower is Better" Metric**

**Scenario:** Track anxiety level (GAD-7 score, 0-21)

```javascript
// Anxiety Level (GAD-7 score, lower is better)
percentileFunctions.anxiety_percentile = (gad7Score) => {
  // GAD-7 scale: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-21 severe
  // Benchmarks from HIGH to LOW anxiety (worst to best)
  const benchmarks = [21, 15, 10, 7, 5, 3, 1, 0];
  
  // Calculate initial percentile
  const percentile = calculatePercentileFromBenchmarks(gad7Score, benchmarks);
  
  // INVERT: Lower anxiety score should = higher percentile
  return 100 - percentile;
};
```

**Dropdown entry:**
```javascript
{ value: 'anxiety_percentile', label: 'Anxiety Level (GAD-7)', category: 'emotional' }
```

**Parameter mapping:**
```javascript
anxiety_percentile: ["value"]
```

---

### **Example 4: Complex Multi-Parameter Function**

**Scenario:** Track deadlift strength

```javascript
// Deadlift Percentile (weight lifted relative to bodyweight, age-adjusted)
percentileFunctions.deadlift_percentile = (weight, age, bodyweight) => {
  // Calculate weight-to-bodyweight ratio
  const ratio = weight / bodyweight;
  
  // Age deterioration factor
  const ageFactor = age < 30 ? 1.0 : 
                    age < 40 ? 0.95 : 
                    age < 50 ? 0.9 : 
                    0.85;
  
  // Adjust ratio for age
  const adjustedRatio = ratio / ageFactor;
  
  // Benchmarks: untrained (1.0x) to elite (3.5x bodyweight)
  const benchmarks = [0, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5];
  
  return calculatePercentileFromBenchmarks(adjustedRatio, benchmarks);
};
```

**Dropdown entry:**
```javascript
{ value: 'deadlift_percentile', label: 'Deadlift (weight/bodyweight)', category: 'physical' }
```

**Parameter mapping:**
```javascript
deadlift_percentile: ["weight", "age", "bodyweight"]
```

---

## 🛠️ Helper Functions Available

These helper functions are provided in `js/percentile/index.js`:

### **1. calculatePercentileFromBenchmarks(value, benchmarks)**
Calculates percentile from a value and benchmark array.

```javascript
const benchmarks = [0, 10, 20, 30, 40, 50];
const percentile = calculatePercentileFromBenchmarks(25, benchmarks);
// Returns: 50 (25 is at 50th percentile)
```

### **2. cumulativeNormalDistribution(z)**
Calculates percentile for normally-distributed metrics (like IQ).

```javascript
const iqScore = 115;
const mean = 100;
const sd = 15;
const z = (iqScore - mean) / sd; // z = 1.0
const percentile = Math.round(cumulativeNormalDistribution(z) * 100);
// Returns: 84 (115 IQ is 84th percentile)
```

---

## ✅ Checklist Before Committing

- [ ] Function added to correct category file
- [ ] Function name follows `snake_case_percentile` convention
- [ ] Benchmarks are in ascending order
- [ ] Benchmarks based on research/data (documented in comments)
- [ ] Handled "lower is better" with inversion if needed
- [ ] Added age/gender adjustments if relevant
- [ ] Function added to dropdown in `getPercentileFunctionOptions()`
- [ ] Parameters mapped in `getParametersForFunction()`
- [ ] Tested with minimum, average, and maximum values
- [ ] Tested with missing parameters (doesn't crash)
- [ ] Comments explain benchmark source and logic

---

## 🐛 Common Issues & Solutions

### **Issue 1: Function not appearing in dropdown**
**Solution:** Check that you added it to `getPercentileFunctionOptions()` array in `index.html`

### **Issue 2: "Function is not defined" error**
**Solution:** 
1. Ensure script tag is added to `index.html`
2. Verify script tag comes BEFORE the main `<script>` block
3. Check function name spelling matches exactly

### **Issue 3: Percentile always returns 0 or 100**
**Solution:** Review your benchmarks - they might be too narrow or inverted

### **Issue 4: Age/gender not working**
**Solution:** 
1. Check user filled out Settings → Personal Information
2. Verify parameter names in `getParametersForFunction()` match function signature

### **Issue 5: Percentile seems wrong**
**Solution:**
1. Verify benchmarks are in correct order (ascending for normal, descending if inverting)
2. Check if metric needs inversion (`100 - percentile`)
3. Test with known values where you know expected percentile

---

## 📞 Need Help?

1. Review existing functions in category files for examples
2. Check browser console (F12) for error messages
3. Test incrementally: add function → test → add to dropdown → test
4. Use simple benchmarks first, refine later with research

---

## 🎉 You're Done!

Your new percentile function is now integrated and ready to use. Users can:
1. Create categories with your metric
2. Select your function from the dropdown
3. Input values and see automatic percentile calculations

**Pro tip:** Document your benchmark sources in code comments for future reference!
