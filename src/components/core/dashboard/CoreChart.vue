<!--
  CoreChart: an ApexCharts chart that keeps the functions of its options (axis and tooltip
  formatters, events) when the options change.

  vue3-apexcharts passes changed options to the chart through JSON, which drops every function in
  them, so a formatter works on the first draw and is gone after the first filter. CoreChart draws
  the chart again when the options change, and lets vue3-apexcharts update the series alone.

  Start the options from `useChartTheme`.

  <CoreChart type="bar" :height="300" :options="options" :series="series" />
-->
<template>
  <div class="core-chart" :style="{ minHeight: `${height}px` }">
    <VueApexCharts :key="revision" :type="type" :height="height" :options="options" :series="series" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import type { ApexOptions } from 'apexcharts'

defineOptions({ name: 'CoreChart' })

const props = withDefaults(
  defineProps<{
    type: NonNullable<NonNullable<ApexOptions['chart']>['type']>
    options: ApexOptions
    series: ApexOptions['series']
    height?: number
  }>(),
  { height: 300 },
)

const revision = ref(0)

watch(
  () => props.options,
  () => {
    revision.value += 1
  },
)
</script>

<style scoped>
.core-chart {
  min-width: 0;
}
</style>
