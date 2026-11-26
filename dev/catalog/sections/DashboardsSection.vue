<template>
  <div ref="root" class="catalog-section">
    <h1 class="catalog-section__title">Dashboards</h1>
    <p class="catalog-section__lead">
      The pieces a dashboard is built from. The charts are ApexCharts, drawn by each dashboard,
      starting from the options of useChartTheme.
    </p>

    <CatalogBlock
      name="CoreStatusBanner"
      api="title · tone (success | warning | danger | info) · icon · stats (CoreStat[])"
      note="The verdict of the page in one line, with the figures that back it."
      column
    >
      <CoreStatusBanner
        title="Feasible plan · 3 products short on 2 days"
        tone="warning"
        :stats="[
          { value: '1,240', label: 'Units short', tone: 'danger' },
          { value: '4,540', label: 'On shipping day' },
          { value: '12', label: 'Extra shifts' },
          { value: '1.8%', label: 'Solver gap' },
        ]"
      />
      <CoreStatusBanner
        title="Optimal plan · no products short"
        tone="success"
        :stats="[
          { value: '0', label: 'Units short' },
          { value: '0', label: 'Extra shifts' },
        ]"
      />
    </CatalogBlock>

    <CatalogBlock
      name="CoreStat"
      api="value · label · tone · icon · caption · size (default | large)"
      note="A figure with its label, inside a <dl>. Only the figures that need attention take a tone."
    >
      <dl class="stat-row">
        <CoreStat value="96%" label="Capacity used" caption="of 2,200 a week" />
        <CoreStat value="1,240" label="Units short" tone="danger" icon="mdi-alert-circle-outline" />
        <CoreStat value="32" label="Orders" size="large" />
      </dl>
    </CatalogBlock>

    <CatalogBlock
      name="CoreRangeFilter · CoreRangeSlider"
      api="v-model [first, last] · labels · label · presets ({ value, label, range | null }[]) · summary"
      note="The stretch of an ordered scale the page shows. A preset without a range is disabled."
      column
    >
      <CoreRangeFilter v-model="range" label="Horizon" :labels="periods" :presets="presets" />
      <div class="slider-sample">
        <CoreRangeSlider v-model="sliderRange" :max="20" />
      </div>
    </CatalogBlock>

    <CatalogBlock
      name="CoreCard · CoreChart"
      api="CoreCard: title · subtitle · icon · flush · slots default, actions, footer — CoreChart: type · options · series · height"
      note="A block of a page; flush lets a table run edge to edge. CoreChart keeps the formatters of its options when they change."
    >
      <CoreCard title="Production per day" subtitle="Units" icon="mdi-chart-bar" class="card-sample">
        <template #actions>
          <CoreSegmentedControl v-model="chartView" :options="chartViews" variant="soft" size="small" />
        </template>
        <CoreChart type="bar" :height="240" :options="chartOptions" :series="chartSeries" />
      </CoreCard>
      <CoreCard title="Shipments" subtitle="This week" class="card-sample card-sample--small">
        <dl class="stat-row">
          <CoreStat value="18" label="Trucks" />
          <CoreStat value="2" label="Late" tone="warning" />
        </dl>
        <template #footer>Updated at 06:00</template>
      </CoreCard>
    </CatalogBlock>

    <CatalogBlock
      name="CoreFigureGrid"
      api="rowHeader · columns ({ key, title, subtitle, emphasis, divider, reference }[]) · rows · total · selectable · v-model:selected · slot detail"
      note="Figures by row and column. Click a figure to open its detail."
      column
    >
      <CoreCard title="Units per line and day" flush>
        <CoreFigureGrid
          v-model:selected="picked"
          row-header="Line"
          :columns="gridColumns"
          :rows="gridRows"
          :total="gridTotal"
          selectable
          :detail-width="260"
        >
          <template #detail="{ row, column }">
            <p class="detail-sample">{{ row }} · {{ column }}</p>
          </template>
        </CoreFigureGrid>
      </CoreCard>
    </CatalogBlock>

    <CatalogBlock
      name="DateRangeFilterCard"
      api="dateFrom · dateTo · loading · i18nKeyPrefix → update:dateFrom, update:dateTo, apply, reset · slot extra-filters"
      note="The labels come from the app's texts under i18nKeyPrefix; the catalog has none, so it shows their keys."
      column
    >
      <DateRangeFilterCard v-model:date-from="from" v-model:date-to="to" />
    </CatalogBlock>

    <CatalogBlock
      name="MapChartFrame"
      api="title · loading · loadingMessage · error · exposes mapContainer"
      note="The card a Leaflet map is drawn into: while it loads, and when it fails."
    >
      <div class="map-sample">
        <MapChartFrame title="Deliveries by region" loading loading-message="Loading the map…" />
      </div>
      <div class="map-sample">
        <MapChartFrame title="Deliveries by region" error="The map could not be loaded" />
      </div>
    </CatalogBlock>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ApexOptions } from 'apexcharts'
import CoreCard from '@cornflow-ui/core/components/core/CoreCard.vue'
import CoreRangeSlider from '@cornflow-ui/core/components/core/CoreRangeSlider.vue'
import CoreSegmentedControl from '@cornflow-ui/core/components/core/CoreSegmentedControl.vue'
import CoreStat from '@cornflow-ui/core/components/core/CoreStat.vue'
import CoreChart from '@cornflow-ui/core/components/core/dashboard/CoreChart.vue'
import CoreFigureGrid, {
  type CoreFigureSelection,
} from '@cornflow-ui/core/components/core/dashboard/CoreFigureGrid.vue'
import CoreRangeFilter from '@cornflow-ui/core/components/core/dashboard/CoreRangeFilter.vue'
import CoreStatusBanner from '@cornflow-ui/core/components/core/dashboard/CoreStatusBanner.vue'
import DateRangeFilterCard from '@cornflow-ui/core/components/dashboard/DateRangeFilterCard.vue'
import MapChartFrame from '@cornflow-ui/core/components/dashboard/MapChartFrame.vue'
import { useChartTheme } from '@cornflow-ui/core/composables/useChartTheme'
import CatalogBlock from '../CatalogBlock.vue'

const root = ref<HTMLElement | null>(null)

const from = ref('2026-10-01')
const to = ref('2026-10-31')

const periods = ['Mon 3', 'Tue 4', 'Wed 5', 'Thu 6', 'Fri 7', 'Wk 10', 'Wk 17', 'Wk 24']
const range = ref<[number, number]>([0, 7])
const sliderRange = ref<[number, number]>([4, 12])
const presets = [
  { value: 'all', label: 'All', range: [0, 7] as [number, number] },
  { value: 'days', label: 'Daily', range: [0, 4] as [number, number] },
  { value: 'weeks', label: 'Weekly', range: [5, 7] as [number, number] },
  { value: 'months', label: 'Monthly', range: null },
]

const chartView = ref('units')
const chartViews = [
  { value: 'units', label: 'Units' },
  { value: 'hours', label: 'Hours' },
]

const { palette, baseOptions } = useChartTheme(root)
const chartSeries = [
  { name: 'Line A', data: [420, 380, 510, 460, 300] },
  { name: 'Line B', data: [210, 260, 190, 240, 280] },
]
const chartOptions = computed<ApexOptions>(() => ({
  ...baseOptions.value,
  chart: { ...baseOptions.value.chart, stacked: true },
  colors: [palette.value.series[0], palette.value.series[2]],
  plotOptions: { bar: { columnWidth: '45%', borderRadius: 3 } },
  xaxis: { ...baseOptions.value.xaxis, categories: periods.slice(0, 5) },
  yaxis: {
    labels: {
      ...(baseOptions.value.yaxis as { labels?: object }).labels,
      formatter: (value: number) => `${value} u`,
    },
  },
}))

const picked = ref<CoreFigureSelection | null>(null)
const gridColumns = [
  { key: 'mon', title: 'Mon 3', subtitle: 'day' },
  { key: 'tue', title: 'Tue 4', subtitle: 'day' },
  { key: 'wed', title: 'Wed 5', subtitle: 'day' },
  { key: 'week', title: 'Week', subtitle: '3/03', emphasis: true, divider: true },
  { key: 'wk10', title: 'Wk 10', subtitle: 'week' },
  { key: 'capacity', title: 'Capacity', subtitle: 'a week', reference: true, divider: true },
]
const gridRows = [
  {
    key: 'Line A',
    label: 'Line A',
    cells: {
      mon: { value: '420', caption: '100%' },
      tue: { value: '380', caption: '90%' },
      wed: { value: '510', caption: '+1 shift' },
      week: { value: '1,310', caption: '104%' },
      wk10: { value: '2,150', caption: '102%' },
      capacity: { value: '2,100' },
    },
  },
  {
    key: 'Line B',
    label: 'Line B',
    cells: {
      mon: { value: '210', caption: '84%' },
      wed: { value: '190', caption: '76%' },
      week: { value: '400', caption: '53%' },
      wk10: { value: '-40', caption: 'short', tone: 'danger' as const },
      capacity: { value: '1,250' },
    },
  },
]
const gridTotal = {
  key: 'total',
  label: 'All lines',
  cells: {
    mon: { value: '630' },
    tue: { value: '380' },
    wed: { value: '700' },
    week: { value: '1,710' },
    wk10: { value: '2,110' },
    capacity: { value: '3,350' },
  },
}
</script>

<style scoped>
.catalog-section__lead {
  margin: 0;
  color: var(--color-text-muted);
}

.stat-row {
  display: flex;
  gap: calc(var(--spacing) * 8);
  margin: 0;
}

.slider-sample {
  max-width: 360px;
}

.card-sample {
  flex: 1 1 420px;
}

.card-sample--small {
  flex: 0 1 280px;
}

.detail-sample {
  margin: 0;
  padding: calc(var(--spacing) * 3);
}

.map-sample {
  width: 360px;
  height: 320px;
  overflow: hidden;
}
</style>
