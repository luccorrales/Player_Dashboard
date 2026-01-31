# Life Stats Dashboard - Modular Architecture

## Project Structure

```
project-root/
│
├── css/
│   └── style.css
│
├── js/
│   ├── config/
│   │   └── supabase.js              # Supabase client & Chart.js initialization
│   │
│   ├── state/
│   │   └── state.js                 # Global application state management
│   │
│   ├── services/
│   │   ├── categoryService.js       # Category CRUD operations
│   │   ├── userService.js           # User profile operations
│   │   ├── weightsGoalsService.js   # Weights & goals operations
│   │   └── metricService.js         # Metric values operations
│   │
│   ├── ui/
│   │   ├── dashboardRenderer.js     # Main dashboard rendering
│   │   ├── chartRenderer.js         # Chart creation (spider, pie, bar, detail)
│   │   ├── modalHandlers.js         # Modal dialogs & forms
│   │   ├── dataHistoryUI.js         # Data history management UI
│   │   ├── inputFormHandlers.js     # Metric input forms
│   │   └── detailPanel.js           # Detail panel rendering
│   │
│   ├── navigation/
│   │   └── tabNavigation.js         # Tab switching & chart settings
│   │
│   ├── features/
│   │   └── drillDown.js             # Drill-down feature
│   │
│   ├── utils/
│   │   └── helpers.js               # Utility functions
│   │
│   ├── percentile/
│   │   ├── index.js                 # (Existing percentile functions)
│   │   └── percentile-functions-config.js
│   │
│   └── main.js                      # Application entry point
│
└── index.html
```

## Module Responsibilities

### Config (`js/config/`)
- **supabase.js**: Exports Supabase client and Chart.js instance

### State (`js/state/`)
- **state.js**: Centralized state management for app data

### Services (`js/services/`)
- **categoryService.js**: Category structure CRUD, tree building
- **userService.js**: User profile loading/saving
- **weightsGoalsService.js**: Category weights and goals management
- **metricService.js**: Metric values CRUD, percentile calculations

### UI (`js/ui/`)
- **dashboardRenderer.js**: Top-level dashboard, sparklines, overall score
- **chartRenderer.js**: All chart types (spider, pie, bar, detail timeline)
- **modalHandlers.js**: Category/metric modals, goals/weights forms
- **dataHistoryUI.js**: Data history tree, editing, filtering
- **inputFormHandlers.js**: Metric input forms, percentile preview
- **detailPanel.js**: Category detail stats and breakdown

### Navigation (`js/navigation/`)
- **tabNavigation.js**: Tab switching, chart settings, category selection

### Features (`js/features/`)
- **drillDown.js**: Drill-down view with bell curve and history charts

### Utils (`js/utils/`)
- **helpers.js**: Reusable utility functions (formatting, aggregation, zones)

### Main (`js/`)
- **main.js**: Application bootstrapping, window function exports

## Key Design Patterns

1. **Separation of Concerns**: Each module has a single, well-defined responsibility
2. **Service Layer**: Database operations isolated in service modules
3. **State Management**: Centralized state prevents prop drilling
4. **UI Components**: Rendering logic separated from business logic
5. **Utility Functions**: Shared helpers prevent code duplication

## Import Strategy

- ES6 modules with explicit imports
- Circular dependency prevention through lazy imports where needed
- Window exports for HTML onclick handlers only in main.js

## Development Notes

- State is mutable but centralized in `state/state.js`
- All Supabase calls go through service layer
- UI modules can import services but not vice versa
- Chart instances stored in state for cleanup/updates
