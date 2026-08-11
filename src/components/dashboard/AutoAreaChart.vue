<template>
  <div class="chart-card">
    <div class="chart-header">
      <div class="chart-title">{{ title }}</div>
    </div>
    <div class="chart-content">
      <ApexChart
        :options="chartOptions"
        :series="series"
        type="area"
        height="350"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
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
  }
}

const props = defineProps<Props>()

const { chartOptions, series } = useAutoChart(() => props.config, {
  chartType: 'area',
  stacked: false,
  zoom: true,
  gradientOpacityFrom: 0.6,
  rotateThreshold: 10,
  rotateAlwaysThreshold: 15,
  sharedTooltip: true,
  markers: (seriesCount) => ({
    size: seriesCount === 1 ? 3 : 2,
    strokeWidth: 0,
    hover: {
      size: 5,
    },
  }),
})
</script>

<style scoped>
/* Styles are inherited from dashboard.css */
</style>
