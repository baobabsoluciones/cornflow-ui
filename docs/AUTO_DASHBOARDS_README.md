# Automatic Dashboards - Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Configuration](#configuration)
3. [Architecture](#architecture)
4. [Components](#components)
5. [Analysis Service](#analysis-service)
6. [Custom Widgets](#custom-widgets)
7. [Data Flow](#data-flow)
8. [Detection Patterns](#detection-patterns)
9. [Customization](#customization)

---

## Introduction

The automatic dashboards system generates dynamic visualizations based on instance and solution table data. The system automatically analyzes table structure and creates appropriate widgets (KPIs, line charts, bar charts, pie charts, area charts, maps) according to detected patterns.

Dashboards are integrated directly into `SectionView.vue`, displaying alongside tables when enabled.

### Main Features

- **Automatic pattern detection**: Analyzes numeric, categorical, date, and coordinate columns
- **Intelligent widget generation**: Creates KPIs, line charts, bar charts, pie charts, area charts, and maps based on data type
- **Table view integration**: Widgets display alongside tables in `SectionView.vue`
- **Responsive layout**: 70/30 layout (table/widgets) with additional charts below
- **Custom widgets**: Allows adding custom components per table
- **Granular control**: Enable/disable automatic dashboards per table

---

## Configuration

### Global Configuration Variables

Automatic dashboards are enabled/disabled via variables in `src/app/config.ts`:

```typescript
{
  core: {
    parameters: {
      // Auto dashboard configuration
      enableAutoInstanceDashboard: true,   // Enables automatic dashboard for instances
      enableAutoSolutionDashboard: true,    // Enables automatic dashboard for solutions
    }
  }
}
```

### Per-Table Configuration

You can configure custom widgets and control automatic dashboards per table:

```typescript
{
  core: {
    parameters: {
      // Dashboard configuration per table
      tableDashboards: {
        // For instance tables
        instance: {
          'refinerias': {
            showAutoDashboards: true,  // true/false or undefined (uses global value)
            customWidgets: [
              {
                component: 'RefineriesMap',  // Vue component name
                props: {                     // Props to pass to the component
                  title: 'Refineries Map',
                  // ... other custom props
                },
                position: 'side' | 'bottom'   // Where to display the widget
              }
            ]
          }
        },
        // For solution tables
        solution: {
          'resultados': {
            showAutoDashboards: false,
            customWidgets: [
              {
                component: 'ResultsChart',
                props: {
                  title: 'Results Chart'
                },
                position: 'bottom'
              }
            ]
          }
        }
      }
    }
  }
}
```

#### Per-Table Configuration Parameters

- **`showAutoDashboards`** (optional): `boolean | undefined`
  - `true`: Shows auto-generated widgets for this table (if globally enabled)
  - `false`: **Hides auto-generated widgets for this table**. Custom widgets (`customWidgets`) will still display if defined
  - `undefined`: Uses the global configuration value (`enableAutoInstanceDashboard` or `enableAutoSolutionDashboard`)

- **`customWidgets`** (optional): `Array<CustomWidgetConfig>`
  - List of custom widgets to display for this table
  - **Important**: Custom widgets display independently of the `showAutoDashboards` value
  - Each widget has:
    - **`component`**: Vue component name to render
    - **`props`**: Object with props to pass to the component
    - **`position`**: `'side'` (right column 30%) or `'bottom'` (below table, 100% width)

#### Common Use Cases

**1. Show only auto-generated widgets (default behavior)**

```typescript
'refinerias': {
  showAutoDashboards: true, // or undefined (uses global)
  // No customWidgets
}
```

**2. Show only custom widgets (without auto-generated)**

```typescript
'refinerias': {
  showAutoDashboards: false, // Disables auto-generated widgets
  customWidgets: [
    {
      component: 'RefineriesMap',
      props: {},
      position: 'side',
    },
  ],
}
```

**3. Show both (auto-generated + custom)**

```typescript
'refinerias': {
  showAutoDashboards: true, // Enables auto-generated widgets
  customWidgets: [
    {
      component: 'RefineriesMap',
      props: {},
      position: 'side',
    },
  ],
}
```

---

## Architecture

### File Structure

```
src/
├── app/
│   └── config.ts                          # Enable/disable configuration and custom widgets
├── services/
│   └── AutoDashboardService.ts           # Analysis and generation logic
├── components/
│   └── dashboard/
│       ├── AutoKPICard.vue                # KPI component
│       ├── AutoLineChart.vue             # Line chart
│       ├── AutoBarChart.vue              # Bar chart
│       ├── AutoPieChart.vue              # Pie chart
│       ├── AutoAreaChart.vue             # Area chart
│       └── AutoMapChart.vue               # Map (only with coordinates)
├── views/
│   └── SectionView.vue                    # Main view (integrates dashboards)
└── assets/
    └── styles/
        └── views/
            └── SectionView.css            # 70/30 layout styles
```

### General Flow

```
1. User navigates to a section (instance/solution)
   ↓
2. SectionView detects the type (input-data/results)
   ↓
3. Checks if dashboards are enabled (global and per table)
   ↓
4. Gets data from the selected execution
   ↓
5. AutoDashboardService analyzes the table
   ↓
6. Generates auto-generated widgets based on detected patterns
   ↓
7. SectionView combines auto-generated + custom widgets
   ↓
8. Renders widgets in 70/30 layout (table/widgets)
```

---

## Components

### Layout in SectionView

Widgets are displayed in a specific layout:

- **Left column (70%)**: Data table
- **Right column (30%)**:
  - KPIs (2 per row, maximum)
  - Small charts (pie, bar, map) - 1 per row
- **Below table (100% width)**:
  - Large charts (area, line) - 2 per row
  - Additional small charts - 2 per row
  - Custom widgets with `position: 'bottom'` - 2 per row

### AutoKPICard

Component for displaying Key Performance Indicators (KPIs).

**Props**:

```typescript
{
  config: {
    value: number                    // Numeric value to display
    label: string                    // KPI label
    format?: 'number' | 'currency' | 'percentage'
    change?: number                  // Percentage change (optional)
    changeValue?: number             // Absolute change value (optional)
    period?: string                  // Time period
    icon?: string                    // Material Design icon
  }
}
```

**Features**:

- Automatic formatting based on type (currency, percentage, number)
- Dynamic icons based on KPI type (total, average, max, min)
- Rounding to maximum 2 decimal places

### AutoLineChart

Line chart for time series.

**Props**:

```typescript
{
  title: string
  config: {
    categories: string[]              // X-axis labels (dates)
    series: Array<{
      name: string
      data: number[]
    }>
  }
}
```

### AutoBarChart

Bar chart for categorical comparisons.

**Props**: Similar to AutoLineChart

### AutoPieChart

Pie chart for distributions.

**Props**:

```typescript
{
  title: string
  config: {
    labels: string[]                  // Category labels
    series: number[]                  // Values for each category
  }
}
```

### AutoAreaChart

Area chart for cumulative data.

**Props**: Similar to AutoLineChart

### AutoMapChart

Interactive map using Leaflet. **Only generated if the table has coordinate columns (lat/lon)**.

**Props**:

```typescript
{
  title: string
  config: {
    coordinates: [number, number][]  // Array of [lat, lon] pairs
    values: number[]                 // Values associated with each coordinate
    valueType: 'binary' | 'numeric'
    valueColumn: string               // Name of the value column
  }
}
```

**Features**:

- Uses coordinates directly (does not geocode names)
- Color markers based on value (green/red for binary, gradient for numeric)
- Popups with coordinate and value information

---

## Analysis Service

### AutoDashboardService

Main service containing all analysis and widget generation logic.

**Location**: `src/services/AutoDashboardService.ts`

### Main Functions

#### `analyzeTable(tableKey: string, data: any[], schema?: any): TableAnalysis | null`

Analyzes a table and determines its structure.

**Parameters**:

- `tableKey`: Table identifier key
- `data`: Array of objects with table data
- `schema`: Optional table schema (for better analysis)

**Returns**: `TableAnalysis` with information about:

- Numeric columns
- Categorical columns
- Date columns
- Binary columns (0 or 1)
- Code/ID columns (excluded)
- Coordinate columns (lat/lon)
- Whether it has time series
- Whether it has categories
- Number of rows

#### `generateDashboardWidgets(analysis: TableAnalysis, locale: string, t?: Function): DashboardWidget[]`

Generates widgets based on table analysis.

**Generation Logic**:

1. **KPIs** (if there are numeric columns and ≤ 3 numeric columns):
   - Total: Sum of all values
   - Average: Average of all values
   - Max: Maximum value
   - Min: Minimum value
   - Values rounded to maximum 2 decimal places

2. **Line chart** (if there are time series):
   - Groups data by date
   - Creates series with numeric values

3. **Bar chart** (if there are categories and ≤ 20 categories):
   - Groups data by category
   - Sums numeric values by category
   - Excludes binary columns

4. **Pie chart** (if there are categories and ≤ 10 categories):
   - Percentage distribution by category

5. **Area chart** (if there are time series):
   - Cumulative data by date

6. **Map** (if there are lat/lon coordinate columns):
   - Only generated if the table has `lat`/`lon` or `latitude`/`longitude` columns
   - Associates numeric or binary values with coordinates
   - Does not geocode city names

#### `generateAutoDashboard(executionData: any, dashboardType: 'instance' | 'solution', tableKey?: string, locale?: string, t?: Function, tableSchema?: any): DashboardWidget[]`

Main function that generates the complete dashboard.

**Parameters**:

- `executionData`: Execution data (instance or solution)
- `dashboardType`: Dashboard type ('instance' or 'solution')
- `tableKey`: (optional) If provided, only generates widgets for that table
- `locale`: Language for translations
- `t`: Translation function
- `tableSchema`: Optional table schema

---

## Custom Widgets

### Configuration

Custom widgets are configured in `src/app/config.ts`:

```typescript
tableDashboards: {
  instance: {
    'refinerias': {
      showAutoDashboards: true,
      customWidgets: [
        {
          component: 'RefineriesMap',
          props: {
            title: 'Refineries Map',
            data: 'refinerias'  // Passed automatically
          },
          position: 'side'
        }
      ]
    }
  }
}
```

### Creating a Custom Widget

1. **Create the component** in `src/components/dashboard/` or wherever you prefer:

```vue
<template>
  <div class="custom-widget">
    <h3>{{ title }}</h3>
    <!-- Your logic here -->
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string
  data?: any[] // Table data is passed automatically
  // ... other props
}

const props = defineProps<Props>()
</script>
```

2. **Register the component** in `SectionView.vue`:

```typescript
import RefineriesMap from '@/components/dashboard/RefineriesMap.vue'

const getWidgetComponent = (type: string) => {
  // ... auto-generated components
  if (type === 'RefineriesMap') return RefineriesMap
  // ...
}
```

3. **Configure in `config.ts`** as shown above

### Automatic Props

The following props are automatically passed to custom widgets:

- **`tableData`**: Current table data (`any[]`)
- **`tableKey`**: Table key (`string`)
- **`executionData`**: Complete execution data (`any`)
- **`executionType`**: Execution type (`'instance' | 'solution'`)

In addition to the props you define in the configuration.

---

## Data Flow

### 1. Initialization

```
User navigates to a section (instance/solution)
  ↓
SectionView mounts
  ↓
Detects section type (input-data/results)
  ↓
Checks global and per-table configuration
```

### 2. Data Retrieval

```
SectionView gets selectedExecution from store
  ↓
Extracts data according to type:
  - Instance: execution.experiment?.instance || execution.instance
  - Solution: execution.experiment?.solution || execution.solution
```

### 3. Analysis and Generation

```
For each table:
  1. Checks showAutoDashboards (table or global)
  2. If enabled:
     - Calls analyzeTable() → gets TableAnalysis
     - Calls generateDashboardWidgets() → gets auto-generated widgets
  3. Gets custom widgets from configuration
  4. Combines both widget arrays
```

### 4. Rendering

```
SectionView receives widgets (auto-generated + custom)
  ↓
Separates widgets into categories:
  - KPIs → right column (2 per row)
  - Small charts (pie, bar, map) → right column (1 per row)
  - Large charts (area, line) → below (2 per row)
  - Custom widgets → according to configured position
  ↓
Renders in 70/30 layout
```

---

## Detection Patterns

### Numeric Columns

A column is considered numeric if:

- All values (sample of up to 100 rows) are valid numbers
- It is not an ID column (`id` or ends in `_id`)
- It is not a code column (detected by `isCodeColumn`)

### Categorical Columns

A column is considered categorical if:

- It has fewer than 20 unique values
- It is not numeric or date
- It is not an ID or code column

### Date Columns

A column is considered a date if:

- Values can be parsed as valid dates
- It is not an ID column

### Binary Columns

A column is considered binary if:

- It has only values 0 and 1
- Or the schema indicates `minimum: 0` and `maximum: 1`
- Not used for bar charts

### Code/ID Columns

A column is considered code/ID if:

- The name contains patterns like `codigo_`, `code_`, `id_`
- And a related column exists (e.g., `codigo_refineria` → `refineria`)
- Excluded from numeric and categorical analysis

### Coordinate Columns

A column is considered a coordinate if:

- The name matches patterns: `lat`, `latitude`, `latitud`, `lon`, `longitude`, `longitud`
- Values are valid numbers in appropriate ranges (lat: -90 to 90, lon: -180 to 180)
- A lat/lon pair is required to generate maps

### Time Series

A time series is detected if:

- There is at least one date column
- There is at least one numeric column
- There is more than 1 row of data

### Categories

Categories are detected if:

- There is at least one categorical column
- There is at least one numeric column
- There is more than 1 row of data

### Additional Filters

- **Zero values**: If all values of a widget are 0, it is not displayed
- **Rounding**: All numeric values are rounded to maximum 2 decimal places

---

## Customization

### Adding New Auto-Generated Widget Types

1. Create the component in `src/components/dashboard/`
2. Add the type in `DashboardWidget` interface:
   ```typescript
   type: 'kpi' | 'line' | 'bar' | 'pie' | 'area' | 'map' | 'new-type'
   ```
3. Add generation logic in `generateDashboardWidgets()`
4. Register the component in `SectionView.getWidgetComponent()`

### Customizing KPI Icons

Icons are automatically assigned based on KPI type:

- `total` → `mdi-calculator`
- `average` → `mdi-chart-line-variant`
- `max` → `mdi-trending-up`
- `min` → `mdi-trending-down`

### Customizing Formats

Formats are automatically detected based on column name:

- Columns with `revenue`, `income`, `sales`, `cost`, `expense`, `price`, `amount`, `value`, `profit`, `margin` → `currency`
- Columns with `percentage`, `percent`, `rate`, `ratio` → `percentage`
- Default → `number`

### Customizing Colors

Colors are obtained from `src/app/assets/styles/variables.css`:

- CSS variables: `--chart-color-1` to `--chart-color-10`
- Components read these variables automatically

### Customizing Styles

Each component has scoped styles. Edit the corresponding `.vue` files in `src/components/dashboard/`.

Layout is controlled in `src/assets/styles/views/SectionView.css`.

---

## Usage Examples

### Expected Data Structure

```json
{
  "data": {
    "refinerias": [
      {
        "codigo_refineria": "R001",
        "refineria": "R. TARRAGONA",
        "operador": "Operador A",
        "intercambio": 1,
        "lat": 41.1189,
        "lon": 1.2445
      }
    ]
  }
}
```

### Auto-Generated Widgets

For a table with coordinates and binary values:

- **KPI**: Total Intercambio
- **KPI**: Average Intercambio
- **Map**: Intercambio Map (with markers at coordinates)

### Custom Widget Configuration

**Show only custom widgets (without auto-generated):**

```typescript
tableDashboards: {
  instance: {
    'refinerias': {
      showAutoDashboards: false, // Disables auto-generated widgets
      customWidgets: [
        {
          component: 'RefineriesMap',
          props: {
            title: 'Custom Refineries Map',
            showDetails: true
          },
          position: 'side'
        }
      ]
    }
  }
}
```

**Show both auto-generated and custom widgets:**

```typescript
tableDashboards: {
  instance: {
    'refinerias': {
      showAutoDashboards: true, // Enables auto-generated widgets
      customWidgets: [
        {
          component: 'RefineriesMap',
          props: {
            title: 'Custom Refineries Map',
            showDetails: true
          },
          position: 'side'
        }
      ]
    }
  }
}
```

---

## Troubleshooting

### Widgets Are Not Generated

1. **For auto-generated widgets:**
   - Verify that `enableAutoInstanceDashboard` or `enableAutoSolutionDashboard` are set to `true`
   - Verify that `showAutoDashboards` for the table is not set to `false`
   - **Important note**: If `showAutoDashboards: false`, only custom widgets (`customWidgets`) will be displayed, not auto-generated ones

2. **For custom widgets:**
   - Verify that `customWidgets` is defined in the table configuration
   - Verify that the component is registered in `SectionView.getWidgetComponent()`

3. **General:**
   - Verify that there is a selected execution
   - Verify that data has the expected structure (`executionData.data`)
   - Check the browser console for errors

### Widgets Do Not Display Correctly

1. Verify that components are correctly imported in `SectionView.vue`
2. Verify that `vue3-apexcharts` is installed
3. Check CSS styles (there may be conflicts)
4. Verify that the 70/30 layout is correctly applied

### Custom Widgets Do Not Appear

1. Verify that the component is registered in `SectionView.getWidgetComponent()`
2. Verify that the component name in `config.ts` matches the imported one
3. Verify that props are correctly defined
4. Check the console for rendering errors

### Maps Are Not Generated

1. Verify that the table has coordinate columns (`lat`/`lon` or `latitude`/`longitude`)
2. Verify that coordinates are valid (lat: -90 to 90, lon: -180 to 180)
3. Verify that `leaflet` is installed
4. Check the console for geocoding errors (though it's no longer used)

---

## References

- [Vue 3 Documentation](https://vuejs.org/)
- [Vuetify 3 Documentation](https://vuetifyjs.com/)
- [ApexCharts Documentation](https://apexcharts.com/)
- [Vue ApexCharts](https://github.com/apexcharts/vue3-apexcharts)
- [Leaflet Documentation](https://leafletjs.com/)
- [Material Design Icons](https://materialdesignicons.com/)

---
