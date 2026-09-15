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
import { computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { useAutoChart } from '@cornflow-ui/core/composables/useAutoChart'
import '@cornflow-ui/core/assets/styles/dashboard.css'

const ApexChart = VueApexCharts

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
    return `${percentage} (${formattedValue})`
  }

  return percentage
}

const getChangeClass = (change: number | undefined): string => {
  if (change === undefined) return ''
  return change > 0 ? 'positive' : 'negative'
}

const { chartOptions, series } = useAutoChart(() => props.config, {
  chartType: 'line',
  zoom: true,
  gradientOpacityFrom: 0.5,
  rotateThreshold: 10,
  rotateAlwaysThreshold: 15,
  sharedTooltip: true,
  markers: (seriesCount) => ({
    size: seriesCount === 1 ? 4 : 3,
    strokeWidth: 0,
    hover: {
      size: 6,
    },
  }),
})
</script>

<style scoped>
.chart-title {
  margin-bottom: 8px;
}

.chart-total-section {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.chart-total-label {
  font-size: 0.8125rem;
  color: var(--subtitle, #6e6e6e);
  font-weight: 500;
}

.chart-total-value {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--title, #404040);
  letter-spacing: -0.01em;
}

.chart-total-change {
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.chart-total-period {
  font-size: 0.8125rem;
  color: var(--subtitle, #6e6e6e);
  font-weight: 400;
}

.chart-message {
  margin: 12px 24px;
  padding: 10px 14px;
  background: var(--primary-light-variant, #e6f1f7);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--title, #404040);
  line-height: 1.5;
  border-left: 3px solid var(--primary, #326786);
}
</style>
