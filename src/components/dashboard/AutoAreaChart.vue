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
import { computed, ref } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { getPrimaryColor, getColorWithOpacity } from '@/utils/chartColors'
import '@/assets/styles/dashboard.css'

const ApexChart = VueApexCharts
const primaryColor = ref(getPrimaryColor())
const primaryLight = ref(getColorWithOpacity(primaryColor.value, 0.2))

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

const chartOptions = computed(() => ({
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
      opacityTo: 0.2,
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
          opacity: 0.2,
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
/* Styles are inherited from dashboard.css */
</style>
