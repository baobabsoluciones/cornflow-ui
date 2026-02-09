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
            <div class="legend-percentage">{{ percentages[index] }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { getChartColors, getCSSVariable } from '@/utils/chartColors'
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
    y: {
      formatter: (val: number) => {
        const total = totalValue.value
        const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0'
        return `${new Intl.NumberFormat('en-US').format(val)} (${pct}%)`
      },
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
  padding: 12px 20px 20px 20px;
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

.chart-legend {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.legend-color {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.legend-label {
  font-size: 0.8125rem;
  color: var(--title, #404040);
  font-weight: 500;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-value {
  font-size: 0.8125rem;
  color: var(--title, #404040);
  font-weight: 600;
  flex-shrink: 0;
}

.legend-percentage {
  font-size: 0.75rem;
  color: var(--subtitle, #6e6e6e);
  font-weight: 400;
  flex-shrink: 0;
  min-width: 40px;
  text-align: right;
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
