<script setup lang="ts">
import { computed } from 'vue'
import InfoCard from '@/app/components/shared/InfoCard.vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  selectedRoute: string | null
  routes: Array<{
    capacity_used: number
    cod_route: string
    distance: number
    duration: number
    first_stop: string
    number_stops: number
    route_id: string
    time_end: string
    time_start: string
  }>
}>()

const { t } = useI18n()

const isAllSelected = computed(() => !props.selectedRoute || props.selectedRoute === 'all')

const selectedRouteInfo = computed(() => {
  if (isAllSelected.value) return null
  return props.routes.find(r => r.route_id === props.selectedRoute || r.cod_route === props.selectedRoute)
})

const aggregateInfo = computed(() => {
  const n = props.routes.length
  if (!n) return null
  const totalStops = props.routes.reduce((sum, r) => sum + r.number_stops, 0)
  const meanDuration = props.routes.reduce((sum, r) => sum + r.duration, 0) / n
  const meanCapacity = props.routes.reduce((sum, r) => sum + r.capacity_used, 0) / n
  const meanDistance = props.routes.reduce((sum, r) => sum + r.distance, 0) / n
  return {
    n,
    totalStops,
    meanDuration,
    meanCapacity,
    meanDistance
  }
})

function formatDuration(seconds: number) {
  if (!seconds && seconds !== 0) return '-'
  const min = Math.floor(seconds / 60)
  const sec = Math.round(seconds % 60)
  return `${min}m ${sec}s`
}

function formatDistance(meters: number) {
  if (!meters && meters !== 0) return '-'
  return `${(meters / 1000).toFixed(2)} km`
}

// Compute route color variable
const routeColor = computed(() => {
  if (!selectedRouteInfo.value) return 'var(--primary)'
  const code = selectedRouteInfo.value.cod_route || selectedRouteInfo.value.route_id
  return `var(--route-${code})`
})

// Route label for title (same as filter selector)
const routeLabel = computed(() => {
  if (isAllSelected.value) {
    return t('routesDashboard.filterSelector.all')
  }
  if (selectedRouteInfo.value) {
    return `${t('routesDashboard.filterSelector.route')} ${selectedRouteInfo.value.cod_route || selectedRouteInfo.value.route_id}`
  }
  return ''
})
</script>

<template>
  <InfoCard :title="routeLabel">
    <template #title>
      <span v-if="!isAllSelected" class="route-dot" :style="{ background: routeColor }"></span>
      <span>{{ routeLabel }}</span>
    </template>
    <div class="global-info-card" :style="{ '--route-accent': routeColor }">
      <template v-if="selectedRouteInfo">
        <div class="info-row">
          <span class="mdi mdi-clock-outline info-icon"></span>
          <span class="info-label">{{ t('routesDashboard.map.startTime') }}</span>
          <span class="info-value">{{ selectedRouteInfo.time_start }}</span>
        </div>
        <div class="info-row">
          <span class="mdi mdi-clock-end info-icon"></span>
          <span class="info-label">{{ t('routesDashboard.globalInfo.arrivalTime', 'Arrival time') }}</span>
          <span class="info-value">{{ selectedRouteInfo.time_end }}</span>
        </div>
        <div class="info-row">
          <span class="mdi mdi-account-group-outline info-icon"></span>
          <span class="info-label">{{ t('routesDashboard.map.employees') }}</span>
          <span class="info-value">{{ selectedRouteInfo.capacity_used }}</span>
        </div>
        <div class="info-row">
          <span class="mdi mdi-sign-direction info-icon"></span>
          <span class="info-label">{{ t('routesDashboard.globalInfo.numberStops', 'Number of stops') }}</span>
          <span class="info-value">{{ selectedRouteInfo.number_stops }}</span>
        </div>
        <div class="info-row">
          <span class="mdi mdi-timer-outline info-icon"></span>
          <span class="info-label">{{ t('routesDashboard.globalInfo.duration', 'Duration') }}</span>
          <span class="info-value">{{ formatDuration(selectedRouteInfo.duration) }}</span>
        </div>
        <div class="info-row mb-3">
          <span class="mdi mdi-map-marker-path info-icon"></span>
          <span class="info-label">{{ t('routesDashboard.globalInfo.distance', 'Distance') }}</span>
          <span class="info-value">{{ formatDistance(selectedRouteInfo.distance) }}</span>
        </div>
      </template>
      <template v-else-if="aggregateInfo">
        <div class="info-row">
          <span class="mdi mdi-routes info-icon"></span>
          <span class="info-label">{{ t('routesDashboard.globalInfo.numberRoutes', 'Number of routes') }}</span>
          <span class="info-value">{{ aggregateInfo.n }}</span>
        </div>
        <div class="info-row">
          <span class="mdi mdi-sign-direction info-icon"></span>
          <span class="info-label">{{ t('routesDashboard.globalInfo.totalStops', 'Total stops') }}</span>
          <span class="info-value">{{ aggregateInfo.totalStops }}</span>
        </div>
        <div class="info-row">
          <span class="mdi mdi-timer-outline info-icon"></span>
          <span class="info-label">{{ t('routesDashboard.globalInfo.meanDuration', 'Mean duration') }}</span>
          <span class="info-value">{{ formatDuration(aggregateInfo.meanDuration) }}</span>
        </div>
        <div class="info-row">
          <span class="mdi mdi-account-group-outline info-icon"></span>
          <span class="info-label">{{ t('routesDashboard.globalInfo.meanCapacity', 'Mean capacity') }}</span>
          <span class="info-value">{{ Math.round(aggregateInfo.meanCapacity) }}</span>
        </div>
        <div class="info-row">
          <span class="mdi mdi-map-marker-path info-icon"></span>
          <span class="info-label">{{ t('routesDashboard.globalInfo.meanDistance', 'Mean distance') }}</span>
          <span class="info-value">{{ formatDistance(aggregateInfo.meanDistance) }}</span>
        </div>
      </template>
      <template v-else>
        <div class="info-row info-placeholder">{{ t('routesDashboard.globalInfo.placeholder') }}</div>
      </template>
    </div>
  </InfoCard>
</template>

<style scoped>
.global-info-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.route-dot {
  display: inline-block;
  width: 1.1em;
  height: 1.1em;
  border-radius: 50%;
  margin-right: 0.5em;
  vertical-align: middle;
  box-shadow: 0 1px 4px 0 rgba(16, 30, 54, 0.10);
}
.info-card-title {
  border-bottom: 2px solid var(--route-accent, var(--primary));
}
.info-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid #f0f0f0;
}
.info-row:last-child {
  border-bottom: none;
}
.info-icon {
  font-size: 1.3em;
  min-width: 28px;
  text-align: center;
  color: var(--route-accent, var(--primary)) !important;
}
.info-label {
  flex: 1;
  color: #666;
  font-size: 1em;
  font-weight: 500;
}
.info-value {
  font-size: 1.08em;
  font-weight: 700;
  color: var(--primary-variant);
  min-width: 60px;
  text-align: right;
}
.info-placeholder {
  color: #aaa;
  font-style: italic;
  justify-content: center;
  width: 100%;
}
</style> 