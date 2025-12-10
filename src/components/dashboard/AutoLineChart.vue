<template>
  <div class="chart-card">
    <div class="chart-header">
      <div class="chart-title">{{ title }}</div>
      <div v-if="config.totalValue !== undefined" class="chart-total-section">
        <div class="chart-total-label">Total {{ title }}:</div>
        <div class="chart-total-value">{{ formattedTotal }}</div>
        <div
          v-if="config.totalChange !== undefined"
          class="chart-total-change"
          :class="getChangeClass(config.totalChange)"
        >
          {{ formatChange(config.totalChange, config.totalChangeValue) }}
        </div>
        <div
          v-if="config.totalChange !== undefined && config.totalPeriod"
          class="chart-total-period"
        >
          {{ config.totalPeriod }}
        </div>
      </div>
    </div>
    <div v-if="config.message" class="chart-message">
      {{ config.message }}
    </div>
    <div class="chart-content">
      <ApexChart
        :options="chartOptions"
        :series="series"
        type="line"
        height="350"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { getPrimaryColor, getColorWithOpacity } from '@/utils/chartColors'
import '@/assets/styles/dashboard.css'

const ApexChart = VueApexCharts
const primaryColor = ref(getPrimaryColor())
const primaryLight = ref(getColorWithOpacity(primaryColor.value, 0.3))

interface Props {
  title: string
  config: {
    categories: string[]
    series: Array<{
      name: string
      data: number[]
    }>
    totalValue?: number
    totalFormat?: 'number' | 'currency' | 'percentage'
    totalChange?: number
    totalChangeValue?: number
    totalPeriod?: string
    message?: string
  }
}

const props = defineProps<Props>()

const formattedTotal = computed(() => {
  if (props.config.totalValue === undefined) return ''
  const { totalValue, totalFormat = 'number' } = props.config

  if (totalFormat === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(totalValue)
  }

  if (totalFormat === 'percentage') {
    return `${totalValue.toFixed(2)}%`
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(totalValue)
})

const formatChange = (
  change: number | undefined,
  changeValue: number | undefined,
): string => {
  if (change === undefined) return ''
  const sign = change > 0 ? '+' : ''
  const percentage = `${sign}${change.toFixed(1)}%`

  if (changeValue !== undefined && props.config.totalFormat === 'currency') {
    const formattedValue = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(changeValue))
    return `${percentage}(${formattedValue})`
  }

  return percentage
}

const getChangeClass = (change: number | undefined): string => {
  if (change === undefined) return ''
  return change > 0 ? 'positive' : 'negative'
}

const chartOptions = computed(() => ({
  chart: {
    type: 'line',
    height: 350,
    toolbar: {
      show: false,
    },
    fontFamily: 'inherit',
    zoom: {
      enabled: false,
    },
  },
  colors: [primaryColor.value],
  stroke: {
    curve: 'smooth',
    width: 3,
  },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.7,
      opacityTo: 0.3,
      stops: [0, 90, 100],
      colorStops: [
        {
          offset: 0,
          color: primaryColor.value,
          opacity: 0.7,
        },
        {
          offset: 100,
          color: primaryLight.value,
          opacity: 0.3,
        },
      ],
    },
  },
  grid: {
    borderColor: 'rgba(0, 0, 0, 0.08)',
    strokeDashArray: 4,
    xaxis: {
      lines: {
        show: false,
      },
    },
    yaxis: {
      lines: {
        show: true,
      },
    },
    padding: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
  },
  xaxis: {
    categories: props.config.categories,
    labels: {
      style: {
        colors: 'var(--subtitle)',
        fontSize: '12px',
        fontFamily: 'inherit',
      },
    },
    axisBorder: {
      show: false,
    },
    axisTicks: {
      show: false,
    },
  },
  yaxis: {
    labels: {
      style: {
        colors: 'var(--subtitle)',
        fontSize: '12px',
        fontFamily: 'inherit',
      },
      formatter: (val: number) => {
        if (val >= 1000) {
          return (val / 1000).toFixed(1) + 'K'
        }
        return val.toFixed(0)
      },
    },
  },
  tooltip: {
    shared: true,
    intersect: false,
    theme: 'light',
    style: {
      fontSize: '12px',
      fontFamily: 'inherit',
    },
    marker: {
      fillColors: [primaryColor.value],
    },
  },
  legend: {
    position: 'top',
    horizontalAlign: 'right',
    fontSize: '12px',
    fontFamily: 'inherit',
    labels: {
      colors: 'var(--title)',
    },
    markers: {
      width: 8,
      height: 8,
      radius: 4,
    },
  },
  dataLabels: {
    enabled: false,
  },
}))

const series = computed(() => props.config.series)
</script>

<style scoped>
.chart-title {
  margin-bottom: 16px;
}

.chart-total-section {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.chart-total-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.chart-total-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  letter-spacing: -0.01em;
}

.chart-total-change {
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.chart-total-period {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 400;
}

.chart-message {
  margin: 16px 24px;
  padding: 12px 16px;
  background: #f3f4f6;
  border-radius: 8px;
  font-size: 0.875rem;
  color: #374151;
  line-height: 1.5;
}
</style>
