<script setup lang="ts">
import { computed } from 'vue'
import InfoCard from '@/app/components/shared/InfoCard.vue'
import { useI18n } from 'vue-i18n'
import type { EmployeeStop } from '@/app/composables/routesDashboard/useEmployeeMap'

const props = defineProps<{
  stops: EmployeeStop[]
}>()

const { t } = useI18n()

const formattedStops = computed(() => 
  props.stops.map((stop, index) => ({
    ...stop,
    colorIndex: (index % 5) + 1
  }))
)

function getStopColor(colorIndex: number) {
  return `var(--route-${colorIndex})`
}
</script>

<template>
  <InfoCard :title="t('employeesDashboard.allStopsHorizontal.title')">
    <div class="all-stops-list">
      <template v-if="formattedStops.length">
        <div class="all-stops-grid">
          <div
            v-for="stop in formattedStops"
            :key="stop.id"
            class="all-stop-card"
            :style="{ '--stop-color': getStopColor(stop.colorIndex) }"
          >
            <div class="all-stop-dot" />
            <div class="all-stop-label">
              {{ t('employeesDashboard.filterSelector.stop') }} {{ stop.name }}
            </div>
            <div class="all-stop-info-row">
              <div class="all-stop-info-item">
                <span class="mdi mdi-account-group" :style="{ color: 'var(--stop-color)' }"></span>
                <span class="all-stop-info-label">{{ t('employeesDashboard.allStopsHorizontal.employees') }}</span>
                <span class="all-stop-info-value">{{ stop.employees.length }}</span>
              </div>
              <div class="all-stop-info-item">
                <span class="mdi mdi-map-marker" :style="{ color: 'var(--stop-color)' }"></span>
                <span class="all-stop-info-label">{{ t('employeesDashboard.map.address', 'Address') }}</span>
                <span class="all-stop-info-value">{{ stop.address }}</span>
              </div>
              <div class="all-stop-info-item">
                <span class="mdi mdi-office-building" :style="{ color: 'var(--stop-color)' }"></span>
                <span class="all-stop-info-label">Departments</span>
                <span class="all-stop-info-value">{{ [...new Set(stop.employees.map(e => e.department))].length }}</span>
              </div>
              <div class="all-stop-info-item">
                <span class="mdi mdi-map-marker" :style="{ color: 'var(--stop-color)' }"></span>
                <span class="all-stop-info-label">{{ t('employeesDashboard.allStopsHorizontal.location') }}</span>
                <span class="all-stop-info-value">{{ stop.lat.toFixed(3) }}, {{ stop.lng.toFixed(3) }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="all-stops-placeholder">{{ t('employeesDashboard.allStopsHorizontal.placeholder') }}</div>
      </template>
    </div>
  </InfoCard>
</template>

<style scoped>
.all-stops-list {
  padding: 12px 0;
}
.all-stops-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 2rem;
  width: 100%;
}
.all-stop-card {
  background: #f9fafb;
  border-radius: 16px;
  box-shadow: 0 2px 8px 0 rgba(16, 30, 54, 0.08);
  padding: 1.5em 1.2em 1.2em 1.2em;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: box-shadow 0.2s, transform 0.2s;
  border: 1px solid #ececec;
}
.all-stop-card:hover {
  box-shadow: 0 4px 16px 0 rgba(16, 30, 54, 0.16);
  transform: translateY(-2px) scale(1.02);
}
.all-stop-dot {
  width: 1.7em;
  height: 1.7em;
  border-radius: 50%;
  margin-bottom: 0.5em;
  background: var(--stop-color, #2196f3);
  border: 3px solid #fff;
  box-shadow: 0 1px 4px 0 rgba(16, 30, 54, 0.10);
}
.all-stop-label {
  font-weight: 800;
  color: var(--primary-variant, #020246);
  font-size: 1.15em;
  margin-bottom: 0.7em;
  letter-spacing: 0.5px;
  text-align: center;
}
.all-stop-info-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.8em;
  width: 100%;
  margin-bottom: 1em;
}
.all-stop-info-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background: white;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
}
.all-stop-info-label {
  font-size: 0.8em;
  color: #888;
  margin-top: 0.2em;
  text-align: center;
}
.all-stop-info-value {
  font-size: 1em;
  font-weight: 600;
  color: #222;
  margin-top: 0.1em;
}
.all-stops-placeholder {
  color: #aaa;
  font-style: italic;
  padding: 1em 0;
  text-align: center;
}
</style> 