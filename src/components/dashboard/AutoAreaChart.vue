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
import { computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { getChartColors, getCSSVariable } from '@/utils/chartColors'
import '@/assets/styles/dashboard.css'

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

const chartOptions = computed(() => {
  const seriesCount = props.config.series.length
  const colors = getChartColors(seriesCount)

  return {
    chart: {
      type: 'area',
      height: 350,
      stacked: false,
      toolbar: {
        show: false,
      },
      fontFamily: 'inherit',
      zoom: {
        enabled: false,
      },
    },
    colors,
    stroke: {
      curve: 'smooth' as const,
      width: 2.5,
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.6,
        opacityTo: 0.1,
        stops: [0, 90, 100],
      },
    },
    grid: {
      borderColor: 'rgba(0, 0, 0, 0.06)',
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
        right: 4,
        bottom: 0,
        left: 4,
      },
    },
    xaxis: {
      categories: props.config.categories,
      labels: {
        style: {
          colors: getCSSVariable('--subtitle'),
          fontSize: '11px',
          fontFamily: 'inherit',
        },
        rotate: props.config.categories.length > 10 ? -45 : 0,
        rotateAlways: props.config.categories.length > 15,
        trim: true,
        maxHeight: 80,
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
          colors: getCSSVariable('--subtitle'),
          fontSize: '11px',
          fontFamily: 'inherit',
        },
        formatter: (val: number) => {
          if (Math.abs(val) >= 1_000_000) {
            return (val / 1_000_000).toFixed(1) + 'M'
          }
          if (Math.abs(val) >= 1_000) {
            return (val / 1_000).toFixed(1) + 'K'
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
      y: {
        formatter: (val: number) => {
          return new Intl.NumberFormat('en-US', {
            maximumFractionDigits: 2,
          }).format(val)
        },
      },
    },
    legend: {
      show: seriesCount > 1,
      position: 'top',
      horizontalAlign: 'right',
      fontSize: '12px',
      fontFamily: 'inherit',
      labels: {
        colors: getCSSVariable('--title'),
      },
      markers: {
        width: 8,
        height: 8,
        radius: 4,
      },
    },
    markers: {
      size: seriesCount === 1 ? 3 : 2,
      strokeWidth: 0,
      hover: {
        size: 5,
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
