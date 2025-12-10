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
import { computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import '@/assets/styles/dashboard.css'

const ApexChart = VueApexCharts

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

const chartOptions = computed(() => {
  const seriesCount = props.config.series.length
  const chartColors = getChartColorPalette(seriesCount)

  return {
    chart: {
      type: 'bar',
      height: 350,
      toolbar: {
        show: false,
      },
      fontFamily: 'inherit',
    },
    colors: chartColors,
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '60%',
        borderRadius: 8,
        borderRadiusApplication: 'end',
        dataLabels: {
          position: 'top',
        },
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
      },
    },
    tooltip: {
      theme: 'light',
      style: {
        fontSize: '12px',
        fontFamily: 'inherit',
      },
      marker: {
        fillColors: getChartColorPalette(props.config.series.length),
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
  }
})

const series = computed(() => props.config.series)
</script>

<style scoped>
/* Styles are inherited from dashboard.css */
</style>
