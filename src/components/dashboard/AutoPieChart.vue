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
            height="220"
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
            :title="label"
          >
            <div
              class="legend-color"
              :style="{ backgroundColor: legendColors[index] }"
            ></div>
            <div class="legend-text">
              <span class="legend-label">{{ label }}</span>
              <span class="legend-stats">
                <span class="legend-value">{{ formattedSeries[index] }}</span>
                <span class="legend-percentage">({{ percentages[index] }})</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { getChartColors } from '@cornflow-ui/core/utils/chartColors'
import '@cornflow-ui/core/assets/styles/dashboard.css'

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

// Calculate colors once for both chart and legend
const chartColors = computed(() =>
  getChartColors(props.config.labels.length),
)

const legendColors = computed(() => chartColors.value)

const totalValue = computed(() =>
  props.config.series.reduce((sum, val) => sum + val, 0),
)

const formattedTotal = computed(() => {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(totalValue.value)
})

const formattedSeries = computed(() => {
  return props.config.series.map((value) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(value)
  })
})

const percentages = computed(() => {
  const total = totalValue.value
  if (total === 0) return props.config.series.map(() => '0%')
  return props.config.series.map((value) => {
    return ((value / total) * 100).toFixed(1) + '%'
  })
})

const chartOptions = computed(() => ({
  chart: {
    type: 'donut' as const,
    height: 220,
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
          width: 180,
        },
      },
    },
  ],
  legend: {
    show: false,
  },
  tooltip: {
    enabled: true,
    fillSeriesColor: false,
    style: {
      fontSize: '13px',
      fontFamily: 'inherit',
    },
    custom: ({ series: s, seriesIndex, w }: any) => {
      const label = w.globals.labels[seriesIndex] || ''
      const value = s[seriesIndex]
      const total = s.reduce((a: number, b: number) => a + b, 0)
      const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0'
      const color = chartColors.value[seriesIndex] || '#999'
      const formattedVal = new Intl.NumberFormat('en-US').format(value)
      return `<div class="pie-tooltip">
        <div class="pie-tooltip-header">
          <span class="pie-tooltip-dot" style="background:${color}"></span>
          <span class="pie-tooltip-label">${label}</span>
        </div>
        <div class="pie-tooltip-body">
          <span class="pie-tooltip-value">${formattedVal}</span>
          <span class="pie-tooltip-pct">(${pct}%)</span>
        </div>
      </div>`
    },
  },
  dataLabels: {
    enabled: true,
    style: {
      fontSize: '11px',
      fontFamily: 'inherit',
      fontWeight: 600,
      colors: ['#ffffff'],
    },
    formatter: (val: number) => {
      return val > 5 ? val.toFixed(1) + '%' : ''
    },
    dropShadow: {
      enabled: false,
    },
  },
  plotOptions: {
    pie: {
      donut: {
        size: '62%',
        labels: {
          show: false,
        },
      },
      expandOnClick: false,
    },
  },
  stroke: {
    width: 2,
    colors: ['#ffffff'],
  },
}))

const series = computed(() => props.config.series)
</script>

<style scoped>
.chart-content {
  padding: 8px 16px 16px 16px;
}

.chart-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.chart-visual {
  position: relative;
  width: 100%;
  max-width: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
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
  color: var(--title, #404040);
  line-height: 1.2;
  margin-bottom: 4px;
  letter-spacing: -0.01em;
}

.chart-center-text {
  font-size: 0.75rem;
  color: var(--subtitle, #6e6e6e);
  font-weight: 500;
}

/* ---- Legend (stacked below chart) ---- */
.chart-legend {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  max-height: 200px;
  overflow-y: auto;
}

.legend-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 3px 4px;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.legend-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.legend-color {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
  margin-top: 3px;
}

.legend-text {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  flex: 1;
  min-width: 0;
}

.legend-label {
  font-size: 0.8125rem;
  color: var(--title, #404040);
  font-weight: 500;
  word-break: break-word;
  line-height: 1.3;
}

.legend-stats {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  flex-shrink: 0;
  margin-left: auto;
  white-space: nowrap;
}

.legend-value {
  font-size: 0.8125rem;
  color: var(--title, #404040);
  font-weight: 600;
}

.legend-percentage {
  font-size: 0.75rem;
  color: var(--subtitle, #6e6e6e);
  font-weight: 400;
}
</style>

<!-- Global (non-scoped) styles for custom tooltip rendered by ApexCharts -->
<style>
.pie-tooltip {
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 8px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  min-width: 120px;
}

.pie-tooltip-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.pie-tooltip-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
  display: inline-block;
}

.pie-tooltip-label {
  font-size: 13px;
  font-weight: 600;
  color: #333333;
  word-break: break-word;
  line-height: 1.3;
}

.pie-tooltip-body {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding-left: 18px;
}

.pie-tooltip-value {
  font-size: 14px;
  font-weight: 700;
  color: #1a1a1a;
}

.pie-tooltip-pct {
  font-size: 12px;
  font-weight: 400;
  color: #666666;
}
</style>
