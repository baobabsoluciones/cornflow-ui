<script setup lang="ts">
import { computed } from 'vue'
import InfoCard from '@/app/components/shared/InfoCard.vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  selectedRoute: string | null
  enrichedRoutes: Array<{
    cod_route: string
    polyline: [number, number][]
    stops: Array<{
      id: string
      name: string
      lat: number
      lng: number
      stop_index?: number
      horary?: string
      capacity_used?: number
    }>
  }>
}>()

const { t } = useI18n()

const route = computed(() => props.enrichedRoutes.find(r => r.cod_route === props.selectedRoute))

const stops = computed(() => route.value?.stops || [])

// Compute color for the route
const routeColor = computed(() => {
  if (!route.value) return 'var(--primary)'
  return `var(--route-${route.value.cod_route})`
})

function getDurationBetweenStops(index: number) {
  if (index === 0 || !stops.value[index]?.horary || !stops.value[index-1]?.horary) return ''
  // Assume horary is HH:mm or HH:mm:ss
  const [h1, m1] = stops.value[index-1].horary.split(':').map(Number)
  const [h2, m2] = stops.value[index].horary.split(':').map(Number)
  let diff = (h2*60 + m2) - (h1*60 + m1)
  if (diff < 0) diff += 24*60
  return `${Math.floor(diff/60)}h ${diff%60}m`
}

const STOP_WIDTH = 200;
const BETWEEN_WIDTH = 200;

const timelineWidth = computed(() => {
  if (!stops.value.length) return '100%';
  return `${stops.value.length * STOP_WIDTH + (stops.value.length - 1) * BETWEEN_WIDTH}px`;
});

const lineWidth = computed(() => {
  if (stops.value.length < 2) return '0px';
  return `${(stops.value.length - 1) * (STOP_WIDTH + BETWEEN_WIDTH)}px`;
});
</script>

<template>
  <InfoCard :title="t('routesDashboard.stopsHorizontal.title')">
    <div class="milestone-timeline-container">
      <div class="milestone-timeline-flex" v-if="stops.length > 1" :style="{ width: timelineWidth }">
        <div class="milestone-line-flex" :style="{ left: STOP_WIDTH / 2 + 'px', width: lineWidth, right: 'unset' }"></div>
        <div class="milestone-flex-row" :style="{ width: timelineWidth }">
          <template v-for="(stop, idx) in stops" :key="stop.id">
            <div class="milestone-stop-flex">
              <div class="milestone-label"><b>{{ stop.name }}</b></div>
              <div class="milestone-circle" :style="{ background: routeColor, borderColor: routeColor }">
                <span class="milestone-order">{{ idx + 1 }}</span>
              </div>
              <div class="milestone-date" :style="{ color: routeColor }">
                <b>{{ stop.horary || '-' }}</b>
              </div>
            </div>
            <div v-if="idx < stops.length - 1" class="milestone-between-flex">
              <div class="capacity-pill-container">
                <span class="capacity-pill">
                  <span class="mdi mdi-account-group-outline"></span>
                  {{ stops[idx + 1].capacity_used || 0 }}
                </span>
              </div>
              <div class="duration-pill-container">
                <span class="duration-pill">
                  <span class="mdi mdi-timer-outline"></span>
                  {{ getDurationBetweenStops(idx + 1) }}
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>
      <div v-else-if="stops.length === 1" class="milestone-timeline-flex">
        <div class="milestone-flex-row">
          <div class="milestone-stop-flex">
            <div class="milestone-label"><b>{{ stops[0].name }}</b></div>
            <div class="milestone-circle" :style="{ background: routeColor, borderColor: routeColor }">
              <span class="milestone-order">1</span>
            </div>
            <div class="milestone-date" :style="{ color: routeColor }">
              <b>{{ stops[0].horary || '-' }}</b>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="milestone-timeline-flex">
        <div class="milestone-flex-row" style="text-align:center;">
          <span>{{ t('routesDashboard.stopsHorizontal.placeholder') }}</span>
        </div>
      </div>
    </div>
  </InfoCard>
</template>

<style scoped>
.milestone-timeline-container {
  width: 100%;
  overflow-x: auto;
  padding-bottom: 1em;
}
.milestone-timeline-flex {
  position: relative;
  min-width: 100%;
  height: 12em;
  margin-top: 2em;
  padding: 0;
}
.milestone-line-flex {
  position: absolute;
  top: 66px;
  left: calc(200px / 2);
  right: calc(200px / 2);
  height: 4px;
  background: #e0e0e0;
  z-index: 1;
  width: auto;
  margin: 0;
}
.milestone-flex-row {
  display: flex;
  align-items: flex-start;
  position: relative;
  z-index: 2;
  min-width: min-content;
  height: 100%;
  padding: 0;
}
.milestone-stop-flex {
  flex: 0 0 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: transparent;
  position: relative;
  margin-left: 0;
}
.milestone-stop-flex:first-child {
  margin-left: 0;
}
.milestone-between-flex {
  flex: 0 0 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  position: relative;
}
.capacity-pill-container {
  position: absolute;
  left: 50%;
  top: 15px;
  transform: translateX(-50%);
  z-index: 3;
}
.duration-pill-container {
  position: absolute;
  top: 6.5em;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
}
.duration-pill {
  width: 100px;
  justify-content: center;
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  padding: 0.18em 0.7em;
  border-radius: 1em;
  font-weight: 600;
  font-size: 0.98em;
  box-shadow: 0 1px 4px 0 rgba(16, 30, 54, 0.08);
  background: #e9f0ff;
  color: var(--primary);
  border: 1px solid var(--primary-light);
}
.capacity-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  padding: 0.18em 0.7em;
  border-radius: 1em;
  font-weight: 600;
  font-size: 0.98em;
  box-shadow: 0 1px 4px 0 rgba(16, 30, 54, 0.08);
  background: #eafaf3;
  color: var(--success, #3ba780);
  border: 1px solid #c6f0dd;
}
.duration-pill .mdi, .capacity-pill .mdi {
  font-size: 1.1em;
  margin-right: 0.2em;
}
.milestone-label {
  font-weight: bold;
  color: var(--primary-variant);
  font-size: 1.08em;
  margin-bottom: 1.2em;
  margin-top: 0.2em;
}
.milestone-date {
  font-weight: bold;
  margin-top: 1.2em;
  font-size: 1.1em;
}
.milestone-circle {
  width: 2.5em;
  height: 2.5em;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 1.3em;
  font-weight: bold;
  margin: 0 auto 0.3em auto;
  box-shadow: 0 1px 4px 0 rgba(16, 30, 54, 0.10);
  border: 4px solid;
  z-index: 2;
}
.milestone-order {
  font-size: 1.2em;
  font-weight: bold;
}
</style> 