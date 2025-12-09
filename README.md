# 🎮 Personal Life Statistics Dashboard

A gamified self-improvement tracking system that quantifies your real-life stats across multiple domains with automatic percentile calculations.

![Dark Theme](https://img.shields.io/badge/theme-dark-purple)
![Status](https://img.shields.io/badge/status-active-success)
![Mobile](https://img.shields.io/badge/mobile-friendly-blue)

---

## ✨ Features

### 📊 Comprehensive Tracking
- **7 Major Domains:** Physical, Cognitive, Social, Financial, Emotional, Relational, Skills
- **70+ Built-in Percentile Functions:** Automatic calculations for common metrics
- **Unlimited Custom Categories:** Create your own hierarchical category structure
- **Multiple Metrics Per Category:** Track as many data points as you need

### 🎯 Smart Analytics
- **Spider/Radar Chart:** Visualize overall performance across all domains
- **Historical Tracking:** Multi-colored line charts show progress over time
- **Weighted Scoring:** Customize which domains matter most to you
- **Automatic Percentiles:** Age, gender, and context-adjusted calculations

### 🎨 Modern Interface
- **Dark Theme:** Easy on the eyes with purple accents
- **Responsive Design:** Works perfectly on mobile and desktop
- **Drill-Down Navigation:** Click any category to see detailed breakdowns
- **Real-Time Calculations:** See percentiles as you type

### 🔧 Fully Modular
- **Edit Without Data Loss:** Modify categories and metrics safely
- **Extensible Functions:** Add new percentile calculations easily
- **Organized Codebase:** Percentile functions separated by category

---

## 🚀 Quick Start

### Prerequisites
- Supabase account (free tier works perfectly)
- Modern web browser
- (Optional) Web hosting for deployment

### Installation

1. **Clone or Download**
   ```bash
   git clone https://github.com/yourusername/life-stats-dashboard.git
   cd life-stats-dashboard
   ```

2. **Set Up Supabase**
   - Create a new Supabase project
   - Run the SQL schema from `IMPLEMENTATION_GUIDE.md`
   - Copy your Project URL and anon key

3. **Configure Credentials**
   Edit `index.html` lines 367-368:
   ```javascript
   const SUPABASE_URL = "YOUR_SUPABASE_URL";
   const SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY";
   ```

4. **Open and Use**
   - Double-click `index.html` to open in browser
   - OR deploy to any static hosting service

---

## 📖 Usage Guide

### First Time Setup

1. **Settings Tab → Personal Information**
   - Enter your age, gender, weight, location
   - These are used for personalized percentile calculations

2. **Manage Categories Tab**
   - Review default categories (Physical, Cognitive, etc.)
   - Add custom categories with "+ Add New Category"
   - Define metrics for each category

3. **Add Data Tab**
   - Select a category that has metrics
   - Enter values for your metrics
   - Watch percentiles calculate automatically!

4. **Dashboard**
   - View spider chart of all domains
   - Click any category for detailed breakdown
   - See historical progress charts

---

## 📁 Project Structure

```
life-stats-dashboard/
├── index.html                          # Main application
├── js/
│   └── percentile/
│       ├── index.js                    # Helper functions
│       ├── percentile-physical.js      # Physical metrics (11 functions)
│       ├── percentile-cognitive.js     # Cognitive metrics (15 functions)
│       ├── percentile-financial.js     # Financial metrics (13 functions)
│       ├── percentile-social.js        # Social metrics (15 functions)
│       └── percentile-emotional.js     # Emotional metrics (20 functions)
├── IMPLEMENTATION_GUIDE.md             # Detailed technical guide
└── README.md                           # This file
```

---

## 🎯 Example Use Cases

### Fitness Tracking
```
Physical
├── Strength
│   ├── Bench Press (lbs) → auto-calculates percentile vs bodyweight
│   ├── Squat (lbs) → age-adjusted percentile
│   └── Deadlift (lbs) → compares to strength standards
└── Cardio
    ├── 5K Time (minutes) → gender + age adjusted
    └── VO2 Max (ml/kg/min) → fitness level percentile
```

### Career Development
```
Skills
├── Programming
│   ├── LeetCode Problems Solved → difficulty-weighted
│   ├── Projects Completed → complexity scoring
│   └── Code Review Speed → efficiency metric
└── Languages
    ├── English (CEFR Level) → standardized assessment
    └── Spanish (CEFR Level) → proficiency tracking
```

### Financial Health
```
Financial
├── Net Worth ($) → age-adjusted percentile
├── Income ($) → national percentile
├── Savings Rate (%) → vs recommended guidelines
└── Credit Score → FICO percentile
```

---

## 🔧 Adding Custom Percentile Functions

See `IMPLEMENTATION_GUIDE.md` for detailed instructions. Quick example:

```javascript
// In js/percentile/percentile-custom.js

percentileFunctions.my_custom_metric = (value, age) => {
  const benchmarks = [0, 10, 25, 50, 75, 90, 100];
  return calculatePercentileFromBenchmarks(value, benchmarks);
};
```

Then add the script tag to `index.html`:
```html
<script src="js/percentile/percentile-custom.js"></script>
```

---

## 📊 Built-in Percentile Functions (74 total)

### Physical (11)
Bench press, squat, deadlift, 5K/10K/marathon times, VO2 max, body fat %, flexibility, push-ups, pull-ups

### Cognitive (15)
IQ, SAT, ACT, GRE, reading speed, typing speed, memory span, reaction time, chess rating, language proficiency

### Financial (13)
Net worth, income, savings rate, credit score, investment returns, emergency fund, debt-to-income, retirement savings

### Social (15)
Friends count, network size, social events, public speaking, social media, volunteering, response time, empathy, languages

### Emotional (20)
EQ, stress management, resilience, meditation, sleep quality, anxiety, depression, life satisfaction, burnout, optimism

---

## 🎨 Customization

### Change Theme Colors
Edit the CSS gradient in `index.html`:
```css
background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
```

### Modify Category Weights
Settings tab → adjust sliders (1-10) for each domain

### Edit Categories
Manage Categories tab → Edit button → modify without losing data

---

## 🔒 Privacy & Data

- All data stored in your private Supabase instance
- No third-party analytics or tracking
- You control your data completely
- Can export data anytime from Supabase

---

## 🛠️ Tech Stack

- **Frontend:** Pure HTML, CSS, JavaScript
- **Charts:** Chart.js
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Static (works anywhere)

---

## 📱 Mobile Support

Fully responsive design works on:
- iOS Safari
- Android Chrome
- Any modern mobile browser

---

## 🤝 Contributing

Contributions welcome! Areas for improvement:
- Additional percentile functions
- New category templates
- UI/UX enhancements
- Documentation improvements

---

## 📝 License

MIT License - feel free to use and modify for personal or commercial use.

---

## 🙏 Acknowledgments

- Inspired by video game RPG stat systems
- Percentile benchmarks sourced from research studies and standardized assessments
- Built with support from the self-improvement community

---

## 📧 Support

For issues or questions:
1. Check `IMPLEMENTATION_GUIDE.md` for detailed technical docs
2. Review browser console for error messages
3. Open an issue on GitHub

---

**Happy tracking! Level up your real life! 🚀📈**
