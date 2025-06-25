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

const { selectedStopInfo, selectedStopEmployees } = useEmployeeInfo(stopsRef, selectedStopRef)

// Compute stop color variable
const stopColor = computed(() => {
  if (!selectedStopInfo.value) return 'var(--primary)'
  const index = props.stops.findIndex(s => s.id === selectedStopInfo.value?.id)
  const colorIndex = (index % 5) + 1
  return `var(--route-${colorIndex})`
})

// Department colors mapping
const departmentColors = {
  'Engineering': '#1976d2',
  'Design': '#7b1fa2',
  'Operations': '#388e3c',
  'Marketing': '#f57c00',
  'HR': '#d32f2f'
}

function getDepartmentColor(department: string): string {
  return departmentColors[department as keyof typeof departmentColors] || '#666666'
}

function getDepartmentBgColor(department: string): string {
  const color = getDepartmentColor(department)
  return `${color}15` // Add 15% opacity version of the color
}
</script>

<template>
  <InfoCard :title="t('employeesDashboard.employeeList.title')">
    <div class="employee-list-container" :style="{ '--stop-accent': stopColor }">
      <template v-if="selectedStopInfo && selectedStopEmployees.length > 0">
        <div class="stop-header">
          <span class="stop-dot" :style="{ background: stopColor }"></span>
          <span class="stop-name">{{ selectedStopInfo.name }}</span>
          <span class="pickup-time">
            <span class="mdi mdi-map-marker-outline"></span>
            {{ selectedStopInfo.address }}
          </span>
        </div>
        
        <div class="employees-grid">
          <div 
            v-for="employee in selectedStopEmployees" 
            :key="employee.id"
            class="employee-card"
          >
            <div class="employee-header">
              <div class="employee-avatar">
                <span class="mdi mdi-account"></span>
              </div>
              <div class="employee-main-info">
                <div class="employee-name">{{ employee.name }}</div>
                <div 
                  class="department-tag"
                  :style="{
                    backgroundColor: getDepartmentBgColor(employee.department),
                    color: getDepartmentColor(employee.department)
                  }"
                >
                  <span class="mdi mdi-office-building-outline"></span>
                  {{ employee.department }}
                </div>
              </div>
            </div>
            
            <div class="employee-details">
              <div class="employee-detail-row" v-if="employee.address">
                <span class="mdi mdi-map-marker-outline detail-icon"></span>
                <span class="detail-value">{{ employee.address }}</span>
              </div>
              <div class="employee-detail-row" v-if="employee.contactInfo">
                <span class="mdi mdi-email-outline detail-icon"></span>
                <span class="detail-value">{{ employee.contactInfo }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="employee-list-placeholder">
          <span class="mdi mdi-account-group-outline placeholder-icon"></span>
          <span>{{ t('employeesDashboard.employeeList.placeholder') }}</span>
        </div>
      </template>
    </div>
  </InfoCard>
</template>

<style scoped>
.employee-list-container {
  padding: 8px 0;
}

.stop-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding: 12px 0;
  border-bottom: 2px solid var(--stop-accent, var(--primary));
}

.stop-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  box-shadow: 0 1px 4px 0 rgba(16, 30, 54, 0.10);
}

.stop-name {
  font-weight: 700;
  font-size: 1.2em;
  color: var(--primary-variant);
}

.pickup-time {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--stop-accent, var(--primary));
}

.employees-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  padding: 8px;
}

.employee-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px 0 rgba(16, 30, 54, 0.08);
  border: 1px solid #f0f0f0;
  transition: box-shadow 0.2s, transform 0.2s;
}

.employee-card:hover {
  box-shadow: 0 4px 16px 0 rgba(16, 30, 54, 0.12);
  transform: translateY(-2px);
}

.employee-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.employee-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--stop-accent, var(--primary));
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.2em;
  flex-shrink: 0;
}

.employee-main-info {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.employee-name {
  font-weight: 700;
  font-size: 1.05em;
  color: var(--primary-variant);
  margin-bottom: 0;
}

.department-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.85em;
  font-weight: 600;
  white-space: nowrap;
}

.department-tag .mdi {
  font-size: 1.1em;
}

.employee-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.employee-detail-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9em;
}

.detail-icon {
  font-size: 1.1em;
  color: var(--stop-accent, var(--primary));
  min-width: 16px;
}

.detail-value {
  color: #555;
}

.employee-list-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 20px;
  color: #aaa;
  font-style: italic;
}

.placeholder-icon {
  font-size: 3em;
  opacity: 0.5;
}
</style> 