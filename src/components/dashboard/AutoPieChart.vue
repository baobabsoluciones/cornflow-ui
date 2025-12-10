<template>
  <div class="chart-card">
    <div class="chart-header">
      <div class="chart-title">{{ title }}</div>
    </div>
    <div class="chart-content">
      <div class="chart-wrapper">
        <div class="chart-visual">
          <ApexChart
            :options="chartOptions"
            :series="series"
            type="donut"
            height="250"
          />
          <div v-if="config.totalLabel" class="chart-center-label">
            <div class="chart-center-total">{{ formattedTotal }}</div>
            <div class="chart-center-text">{{ config.totalLabel }}</div>
          </div>
        </div>
        <div v-if="config.showLegend !== false" class="chart-legend">
          <div
            v-for="(label, index) in config.labels"
            :key="index"
            class="legend-item"
          >
            <div
              class="legend-color"
              :style="{ backgroundColor: legendColors[index] }"
            ></div>
            <div class="legend-label">{{ label }}</div>
            <div class="legend-value">{{ formattedSeries[index] }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import '@/assets/styles/dashboard.css'

const ApexChart = VueApexCharts

interface Props {
  title: string
  config: {
    labels: string[]
    series: number[]
    totalLabel?: string
    showLegend?: boolean
  }
}

const props = defineProps<Props>()

/**
 * Get CSS variable value as hex color
 */
function getCSSVariable(variableName: string): string {
  if (typeof window === 'undefined') {
    return '#0984c6' // Fallback for SSR
  }

  // Try to get from documentElement first, then body
  let value = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim()

  if (!value) {
    value = getComputedStyle(document.body)
      .getPropertyValue(variableName)
      .trim()
  }

  // Fallback to hardcoded colors if variable not found
  if (!value) {
    const fallbacks: Record<string, string> = {
      '--chart-color-1': '#0984c6',
      '--chart-color-2': '#065a8e',
      '--chart-color-3': '#014b5b',
      '--chart-color-4': '#3ba780',
      '--chart-color-5': '#0a9d8f',
      '--chart-color-6': '#4db3d0',
      '--chart-color-7': '#027a9e',
      '--chart-color-8': '#2d7a5f',
      '--chart-color-9': '#5cb8a8',
      '--chart-color-10': '#1a6b8a',
    }
    return fallbacks[variableName] || '#0984c6'
  }

  return value
}

/**
 * Get chart colors from CSS variables
 * Returns an array of colors for multiple series
 */
function getChartColorPalette(count: number): string[] {
  const colors: string[] = []
  for (let i = 0; i < count; i++) {
    const colorIndex = (i % 10) + 1
    colors.push(getCSSVariable(`--chart-color-${colorIndex}`))
  }
  return colors
}

// Calculate colors once for both chart and legend
const chartColors = computed(() =>
  getChartColorPalette(props.config.labels.length),
)

const legendColors = computed(() => chartColors.value)

const formattedTotal = computed(() => {
  const total = props.config.series.reduce((sum, val) => sum + val, 0)
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(total)
})

const formattedSeries = computed(() => {
  return props.config.series.map((value) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(value)
  })
})

const chartOptions = computed(() => ({
  chart: {
    type: 'donut',
    height: 250,
    toolbar: {
      show: false,
    },
    fontFamily: 'inherit',
  },
  colors: chartColors.value,
  labels: props.config.labels,
  responsive: [
    {
      breakpoint: 480,
      options: {
        chart: {
          width: 200,
        },
        legend: {
          position: 'bottom',
        },
      },
    },
  ],
  legend: {
    show: false,
  },
  tooltip: {
    theme: 'light',
    style: {
      fontSize: '12px',
      fontFamily: 'inherit',
    },
  },
  dataLabels: {
    enabled: true,
    style: {
      fontSize: '12px',
      fontFamily: 'inherit',
      colors: ['white'],
    },
    dropShadow: {
      enabled: false,
    },
  },
  plotOptions: {
    pie: {
      donut: {
        size: '65%',
        labels: {
          show: false,
        },
      },
      expandOnClick: false,
    },
  },
}))

const series = computed(() => props.config.series)
</script>

<style scoped>
.chart-content {
  padding: 20px;
}

.chart-wrapper {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  flex: 1;
  min-height: 0;
}

.chart-visual {
  position: relative;
  flex: 0 0 auto;
  width: 250px;
  max-width: 250px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.chart-center-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: none;
}

.chart-center-total {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--title);
  line-height: 1.2;
  margin-bottom: 4px;
  letter-spacing: -0.01em;
}

.chart-center-text {
  font-size: 0.75rem;
  color: var(--subtitle);
  font-weight: 500;
}

.chart-legend {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.legend-label {
  font-size: 0.8125rem;
  color: var(--title);
  font-weight: 500;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-value {
  font-size: 0.8125rem;
  color: var(--subtitle);
  font-weight: 400;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .chart-wrapper {
    flex-direction: column;
    align-items: center;
  }

  .chart-visual {
    width: 100%;
    max-width: 250px;
  }

  .chart-legend {
    width: 100%;
    min-width: auto;
  }
}
</style>
