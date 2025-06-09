<script setup lang="ts">
import { computed } from 'vue'
import InfoCard from '@/app/components/shared/InfoCard.vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  routes: Array<{
    cod_route: string
    capacity_used: number
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

const formattedRoutes = computed(() => props.routes)
</script>

<template>
  <InfoCard :title="t('routesDashboard.allRoutesHorizontal.title', 'All Routes Overview')">
    <div class="all-routes-list">
      <template v-if="formattedRoutes.length">
        <div class="all-routes-grid">
          <div
            v-for="route in formattedRoutes"
            :key="route.cod_route"
            class="all-route-card"
            :style="{ '--route-color': `var(--route-${route.cod_route})` }"
          >
            <div class="all-route-dot" />
            <div class="all-route-label">
              {{ t('routesDashboard.filterSelector.route') }} {{ route.cod_route }}
            </div>
            <div class="all-route-info-row">
              <div class="all-route-info-item">
                <span class="mdi mdi-sign-direction" :style="{ color: 'var(--route-color)' }"></span>
                <span class="all-route-info-label">{{ t('routesDashboard.allRoutesHorizontal.stops') }}</span>
                <span class="all-route-info-value">{{ route.number_stops }}</span>
              </div>
              <div class="all-route-info-item">
                <span class="mdi mdi-account-group" :style="{ color: 'var(--route-color)' }"></span>
                <span class="all-route-info-label">{{ t('routesDashboard.allRoutesHorizontal.capacity') }}</span>
                <span class="all-route-info-value">{{ route.capacity_used }}</span>
              </div>
              <div class="all-route-info-item">
                <span class="mdi mdi-clock-outline" :style="{ color: 'var(--route-color)' }"></span>
                <span class="all-route-info-label">{{ t('routesDashboard.allRoutesHorizontal.duration') }}</span>
                <span class="all-route-info-value">{{ Math.round(route.duration / 60) }} min</span>
              </div>
              <div class="all-route-info-item">
                <span class="mdi mdi-map-marker-distance" :style="{ color: 'var(--route-color)' }"></span>
                <span class="all-route-info-label">{{ t('routesDashboard.allRoutesHorizontal.distance') }}</span>
                <span class="all-route-info-value">{{ (route.distance / 1000).toFixed(1) }} km</span>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="all-routes-placeholder">{{ t('routesDashboard.allRoutesHorizontal.placeholder') }}</div>
      </template>
    </div>
  </InfoCard>
</template>

<style scoped>
.all-routes-list {
  padding: 12px 0;
}
.all-routes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 2rem;
  width: 100%;
}
.all-route-card {
  background: #f9fafb;
  border-radius: 16px;
  box-shadow: 0 2px 8px 0 rgba(16, 30, 54, 0.08);
  padding: 1.2em 1em 1em 1em;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: box-shadow 0.2s, transform 0.2s;
  border: 1px solid #ececec;
}
.all-route-card:hover {
  box-shadow: 0 4px 16px 0 rgba(16, 30, 54, 0.16);
  transform: translateY(-2px) scale(1.03);
}
.all-route-dot {
  width: 1.7em;
  height: 1.7em;
  border-radius: 50%;
  margin-bottom: 0.5em;
  background: var(--route-color, #2196f3);
  border: 3px solid #fff;
  box-shadow: 0 1px 4px 0 rgba(16, 30, 54, 0.10);
}
.all-route-label {
  font-weight: 800;
  color: var(--primary-variant, #020246);
  font-size: 1.15em;
  margin-bottom: 0.7em;
  letter-spacing: 0.5px;
  text-align: center;
}
.all-route-info-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5em;
  width: 100%;
  margin-bottom: 0.3em;
}
.all-route-info-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.all-route-info-label {
  font-size: 0.85em;
  color: #888;
  margin-top: 0.1em;
}
.all-route-info-value {
  font-size: 1.05em;
  font-weight: 600;
  color: #222;
}
.all-routes-placeholder {
  color: #aaa;
  font-style: italic;
  padding: 1em 0;
  text-align: center;
}
</style> 