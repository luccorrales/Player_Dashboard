# 🎮 Personal Life Statistics Dashboard

A gamified self-improvement tracking system that quantifies your real-world personal stats like a video game character sheet.

## ✨ Features

### 📊 Core Functionality
- **7 Life Domains**: Physical, Cognitive, Social, Relational, Financial, Emotional, Skills
- **Percentile Tracking**: Rank yourself against comparison groups (age, location, profession)
- **Sub-Stats**: Detailed breakdowns within each domain
- **Dynamic Tracking**: Monitor progress over months and years
- **Weighted Scoring**: Customize which domains matter most to you

### 🎯 Advanced Features
- **Achievement System**: Unlock milestones as you improve
- **Warning System**: Get alerted when stats decline significantly
- **Future Projections**: See where you'll be in 5-10 years based on current trends
- **Historical Charts**: Visualize your progress over time
- **Comparison Groups**: Compare yourself across multiple peer groups

## 🚀 Quick Start

### Prerequisites
- A Supabase account (free tier works perfectly)
- A modern web browser
- Basic understanding of HTML/CSS/JS (for customization)

### Setup Instructions

#### 1. Database Setup (Supabase)

1. Create a new Supabase project at [supabase.com](https://supabase.com)

2. Go to **SQL Editor** and run this SQL:

```sql
-- Create stat entries table
CREATE TABLE stat_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  sub_stat TEXT NOT NULL,
  value DECIMAL,
  percentile DECIMAL NOT NULL CHECK (percentile >= 0 AND percentile <= 100),
  comparison_group TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create category weights table
CREATE TABLE category_weights (
  id INTEGER PRIMARY KEY DEFAULT 1,
  weights JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default weights
INSERT INTO category_weights (id, weights) 
VALUES (1, '{"physical": 5, "cognitive": 5, "social": 5, "relational": 5, "financial": 5, "emotional": 5, "skills": 5}');

-- Enable Row Level Security
ALTER TABLE stat_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_weights ENABLE ROW LEVEL SECURITY;

-- Create policies (public access for single-user app)
CREATE POLICY "Allow all operations" ON stat_entries FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON category_weights FOR ALL USING (true);

-- Create indexes for performance
CREATE INDEX idx_stat_entries_category ON stat_entries(category);
CREATE INDEX idx_stat_entries_created_at ON stat_entries(created_at DESC);
```

3. Get your credentials:
   - Go to **Project Settings** → **API**
   - Copy your **Project URL**
   - Copy your **anon/public key**

#### 2. Configure the Application

1. Open `app.js` in a text editor

2. Replace the placeholder credentials:

```javascript
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_KEY = "your-anon-key-here";
```

#### 3. Deploy

**Option A: Local Development**
- Simply open `index.html` in your browser
- No server required!

**Option B: GitHub Pages**
1. Create a GitHub repository
2. Upload all files (index.html, styles.css, app.js, README.md)
3. Go to repo Settings → Pages
4. Deploy from main branch
5. Access via `https://yourusername.github.io/life-stats-dashboard`

**Option C: Netlify Drop**
1. Go to [netlify.com/drop](https://netlify.com/drop)
2. Drag and drop your folder
3. Get instant live URL

**Option D: Vercel**
1. Import your GitHub repo to Vercel
2. Deploy with one click

## 📖 How to Use

### Adding Your First Stats

1. Click **"➕ Add Data"** tab
2. Select a **Category** (e.g., Physical)
3. Select a **Sub-Stat** (e.g., Strength)
4. Enter your **raw value** (optional, e.g., "75kg bench press")
5. Enter your **percentile** (0-100, research population benchmarks)
6. Select your **comparison group** (age, profession, location)
7. Add **notes** if desired
8. Click **"Add Entry"**

### Finding Percentile Rankings

Research population norms for your stats:
- **Physical**: Fitness test databases, WHO guidelines
- **Cognitive**: IQ tests, standardized assessments
- **Financial**: Income percentile calculators by location/age
- **Social**: Self-assessment against social skills frameworks
- **Emotional**: EQ assessments, psychology resources

### Customizing Importance Weights

1. Go to **"⚙️ Settings"** tab
2. Adjust sliders (1-10) for each domain
3. Higher numbers = more important to you
4. Click **"Save Weights"**
5. Your overall score updates based on your priorities

### Tracking Progress

- Visit **"📈 History"** to see progress charts
- Check **"🏆 Achievements"** for unlocked milestones
- Review **"🔮 Projections"** for future forecasts
- Dashboard shows warnings for declining stats

## 🎨 Customization

### Adding New Categories

Edit `app.js` and add to the `CATEGORIES` object:

```javascript
const CATEGORIES = {
  // ... existing categories
  creative: {
    name: "Creative",
    icon: "🎨",
    subStats: ["Drawing", "Writing", "Music", "Photography"]
  }
};
```

### Creating Custom Achievements

Edit the `ACHIEVEMENTS` array in `app.js`:

```javascript
{
  id: 9,
  title: "Custom Achievement",
  icon: "🌟",
  condition: "custom_logic_here",
  unlocked: false
}
```

### Styling Changes

Edit `styles.css` to customize:
- Color scheme (search for `#667eea` and `#764ba2`)
- Font sizes
- Card layouts
- Responsive breakpoints

## 📊 Project Structure

```
life-stats-dashboard/
├── index.html          # Main HTML structure
├── styles.css          # All styling
├── app.js              # Application logic
├── README.md           # This file
└── .gitignore          # Git ignore rules
```

## 🔒 Security Notes

**Current Setup**: Single-user application with public database access

**For Production**:
1. Enable Supabase Authentication
2. Update RLS policies to restrict by user_id
3. Never commit API keys to public repos
4. Use environment variables for credentials

## 🛠️ Future Enhancements

Potential features to add:
- [ ] Multi-user support with authentication
- [ ] Data export (CSV, JSON)
- [ ] Mobile app version
- [ ] API integrations (fitness trackers, bank accounts)
- [ ] Social features (compare with friends)
- [ ] AI-powered insights and recommendations
- [ ] Reminder system for regular updates
- [ ] Photo/document attachments for evidence
- [ ] Custom comparison groups
- [ ] Advanced statistical analysis

## 🐛 Troubleshooting

### "Failed to load dashboard"
- Check Supabase credentials in `app.js`
- Verify tables exist in Supabase
- Check browser console for errors

### Charts not displaying
- Ensure Chart.js CDN is loading
- Check for JavaScript errors in console
- Verify data exists in database

### Percentiles not calculating
- Ensure percentile values are between 0-100
- Check that entries are saving to database
- Verify category names match exactly

## 📄 License

MIT License - Feel free to modify and distribute

## 🤝 Contributing

This is a personal project, but suggestions are welcome! 

Open an issue or submit a pull request on GitHub.

## 💡 Inspiration

Inspired by video game RPG stat systems and the quantified self movement.

## 📧 Support

For questions or issues:
- Check the [Supabase documentation](https://supabase.com/docs)
- Review browser console errors
- Open a GitHub issue

---

**Built with**: Vanilla JavaScript, Chart.js, Supabase

**Version**: 1.0.0

**Last Updated**: December 2024
