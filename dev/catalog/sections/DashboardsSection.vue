<template>
  <div class="catalog-section">
    <h1 class="catalog-section__title">Dashboards</h1>
    <p class="catalog-section__lead">
      The pieces of the dashboards that take their look from the tokens. The charts themselves are
      ApexCharts and Leaflet, drawn by each dashboard.
    </p>

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
import { ref } from 'vue'
import DateRangeFilterCard from '@cornflow-ui/core/components/dashboard/DateRangeFilterCard.vue'
import MapChartFrame from '@cornflow-ui/core/components/dashboard/MapChartFrame.vue'
import CatalogBlock from '../CatalogBlock.vue'

const from = ref('2026-10-01')
const to = ref('2026-10-31')
</script>

<style scoped>
.catalog-section__lead {
  margin: 0;
  color: var(--color-text-muted);
}

.map-sample {
  width: 360px;
  height: 320px;
  overflow: hidden;
}
</style>
