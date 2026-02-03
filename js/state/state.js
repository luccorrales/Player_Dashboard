export const state = {
  categoryStructure: [],
  spiderChart: null,
  detailChart: null,
  currentWeights: {},
  currentGoals: {},
  selectedCategory: null,
  userProfile: {},
  metricDefinitions: [],
  chartSettings: {
    scale: 'monthly',
    units: 6,
    customStart: null,
    customEnd: null,
    customAggregation: 'daily'
  },
  expandedCategories: new Set(),
  editingEntries: new Set(),
  sparklineCharts: new Map(),
  drillDown: {
    active: false,
    category: null,
    subcategory: null,
    bellCurveChart: null,
    historyChart: null,
    cursorSystem: null, // Unified cursor interaction system
    settings: {
      scale: 'monthly',
      units: 6,
      customStart: null,
      customEnd: null,
      customAggregation: 'daily'
    }
  }
};