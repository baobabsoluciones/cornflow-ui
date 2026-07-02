<template>
  <div class="chart-card">
    <div class="chart-header">
      <div class="chart-title">{{ title }}</div>
    </div>
    <div class="chart-content">
      <ApexChart
        :options="chartOptions"
        :series="series"
        type="bar"
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
  chartType: 'bar',
  plotOptions: {
    bar: {
      horizontal: false,
      columnWidth: '60%',
      borderRadius: 6,
      borderRadiusApplication: 'end',
      dataLabels: {
        position: 'top',
      },
    },
  },
  rotateThreshold: 8,
  rotateAlwaysThreshold: 12,
})
</script>

<style scoped>
/* Styles are inherited from dashboard.css */
</style>
