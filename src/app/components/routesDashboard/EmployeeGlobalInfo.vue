<script setup lang="ts">
import { computed, toRef } from 'vue'
import InfoCard from '@/app/components/shared/InfoCard.vue'
import { useI18n } from 'vue-i18n'
import type { EmployeeStop } from '@/app/composables/routesDashboard/useEmployeeMap'
import { useEmployeeInfo } from '@/app/composables/routesDashboard/useEmployeeInfo'

const props = defineProps<{
  selectedStop: string | null
  stops: EmployeeStop[]
}>()

const { t } = useI18n()

// Convert props to refs for reactivity
const stopsRef = toRef(props, 'stops')
const selectedStopRef = toRef(props, 'selectedStop')

const { isAllSelected, selectedStopInfo, aggregateInfo } = useEmployeeInfo(stopsRef, selectedStopRef)

// Compute stop color variable
const stopColor = computed(() => {
  if (!selectedStopInfo.value) return 'var(--primary)'
  const index = props.stops.findIndex(s => s.id === selectedStopInfo.value?.id)
  const colorIndex = (index % 5) + 1
  return `var(--route-${colorIndex})`
})

// Stop label for title
const stopLabel = computed(() => {
  if (isAllSelected.value) {
    return t('employeesDashboard.filterSelector.all')
  }
  if (selectedStopInfo.value) {
    return `${t('employeesDashboard.filterSelector.stop')} ${selectedStopInfo.value.name}`
  }
  return ''
})
</script>

<template>
  <InfoCard :title="stopLabel">
    <template #title>
      <span v-if="!isAllSelected" class="stop-dot" :style="{ background: stopColor }"></span>
      <span>{{ stopLabel }}</span>
    </template>
    <div class="global-info-card" :style="{ '--stop-accent': stopColor }">
      <template v-if="selectedStopInfo">
        <div class="info-row">
          <span class="mdi mdi-map-marker-outline info-icon"></span>
          <span class="info-label">{{ t('employeesDashboard.map.address', 'Address') }}</span>
          <span class="info-value">{{ selectedStopInfo.address }}</span>
        </div>
        <div class="info-row">
          <span class="mdi mdi-account-group-outline info-icon"></span>
          <span class="info-label">{{ t('employeesDashboard.globalInfo.totalEmployees') }}</span>
          <span class="info-value">{{ selectedStopInfo.employees.length }}</span>
        </div>
        <div class="info-row">
          <span class="mdi mdi-map-marker-outline info-icon"></span>
          <span class="info-label">{{ t('employeesDashboard.map.stopName') }}</span>
          <span class="info-value">{{ selectedStopInfo.name }}</span>
        </div>
        <div class="info-row mb-3">
          <span class="mdi mdi-office-building-outline info-icon"></span>
          <span class="info-label">{{ t('employeesDashboard.employeeList.department') }}</span>
          <span class="info-value">
            {{ [...new Set(selectedStopInfo.employees.map(e => e.department))].length }} depts
          </span>
        </div>
      </template>
      <template v-else-if="aggregateInfo">
        <div class="info-row">
          <span class="mdi mdi-map-marker-multiple info-icon"></span>
          <span class="info-label">{{ t('employeesDashboard.globalInfo.totalStops') }}</span>
          <span class="info-value">{{ aggregateInfo.totalStops }}</span>
        </div>
        <div class="info-row">
          <span class="mdi mdi-account-group-outline info-icon"></span>
          <span class="info-label">{{ t('employeesDashboard.globalInfo.totalEmployees') }}</span>
          <span class="info-value">{{ aggregateInfo.totalEmployees }}</span>
        </div>
        <div class="info-row">
          <span class="mdi mdi-account-multiple-plus info-icon"></span>
          <span class="info-label">{{ t('employeesDashboard.globalInfo.averageEmployeesPerStop') }}</span>
          <span class="info-value">{{ Math.round(aggregateInfo.averageEmployeesPerStop * 10) / 10 }}</span>
        </div>
        <div class="info-row">
          <span class="mdi mdi-office-building-outline info-icon"></span>
          <span class="info-label">{{ t('employeesDashboard.employeeList.department', 'Departments') }}</span>
          <span class="info-value">{{ aggregateInfo.departmentDistribution.length }}</span>
        </div>
      </template>
      <template v-else>
        <div class="info-row info-placeholder">{{ t('employeesDashboard.globalInfo.placeholder') }}</div>
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
.stop-dot {
  display: inline-block;
  width: 1.1em;
  height: 1.1em;
  border-radius: 50%;
  margin-right: 0.5em;
  vertical-align: middle;
  box-shadow: 0 1px 4px 0 rgba(16, 30, 54, 0.10);
}
.info-card-title {
  border-bottom: 2px solid var(--stop-accent, var(--primary));
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
  color: var(--stop-accent, var(--primary)) !important;
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