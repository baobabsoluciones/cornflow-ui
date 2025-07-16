<template>
  <div class="view-container">
    <div class="d-flex align-end justify-start mb-10">
      <MTitleView
        :icon="'mdi-account-group'"
        :title="title"
        :description="description"
      />
      <ExecutionInfoMenu
        v-if="selectedExecution"
        :selectedExecution="selectedExecution"
      />
      <EmployeeStopFilterSelector 
        v-if="selectedExecution" 
        class="ml-10" 
        :stops="employeeStops" 
        :selected="selectedStop"
        @update:selected="selectedStop = $event" 
      />
    </div>
    <ExecutionInfoCard :selectedExecution="selectedExecution">
    </ExecutionInfoCard>
    <div v-if="selectedExecution">
      <div class="employees-dashboard-layout">
        <div class="employees-dashboard-map">
          <EmployeeMap
            :stops="employeeStops"
            :selectedStop="selectedStop"
            @update:selected="selectedStop = $event"
            @employee-click="handleEmployeeClick"
          />
        </div>
        <div class="employees-dashboard-info">
          <EmployeeGlobalInfo :selectedStop="selectedStop" :stops="employeeStops" />
        </div>
      </div>
      <div class="employees-dashboard-bottom">
        <EmployeeListDetail v-if="selectedStop !== 'all'" :selectedStop="selectedStop" :stops="employeeStops" />
        <AllStopsHorizontal v-else :stops="employeeStops" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import EmployeeStopFilterSelector from '../components/routesDashboard/EmployeeStopFilterSelector.vue'
import EmployeeMap from '../components/routesDashboard/EmployeeMap.vue'
import EmployeeGlobalInfo from '../components/routesDashboard/EmployeeGlobalInfo.vue'
import EmployeeListDetail from '../components/routesDashboard/EmployeeListDetail.vue'
import AllStopsHorizontal from '../components/routesDashboard/AllStopsHorizontal.vue'
import ExecutionInfoCard from '@/components/project-execution/ExecutionInfoCard.vue'
import ExecutionInfoMenu from '@/components/project-execution/ExecutionInfoMenu.vue'
import { useGeneralStore } from '@/stores/general'
import type { EmployeeStop, Employee } from '@/app/composables/routesDashboard/useEmployeeMap'
import { useEmployeeInfo } from '@/app/composables/routesDashboard/useEmployeeInfo'

const generalStore = useGeneralStore()
const showSnackbar = inject('showSnackbar')
const { t } = useI18n()

const selectedExecution = computed(() => generalStore.selectedExecution)
const selectedStop = ref<string | null>('all')

// Handle employee click from map
function handleEmployeeClick(employee: Employee) {
  console.log('Employee clicked:', employee)
  // Future: Could open employee detail modal or navigate to employee details
}

// Generate mock employee stop data based on solution data
const employeeStops = computed((): EmployeeStop[] => {
  const solution = selectedExecution.value?.experiment?.solution?.data
  const instance = selectedExecution.value?.experiment?.instance?.data
  
  if (!solution || !instance) return []
  
  const { employees = [], busStops = [] } = instance
  const { employees_busStop_assignation = [] } = solution
  
  // Create a map of bus stops
  const stopMap = new Map<string, EmployeeStop>()
  
  // First, create all bus stops
  busStops.forEach((stop, index) => {
    stopMap.set(stop.busStop, {
      id: stop.busStop,
      name: stop.busStop,
      lat: stop.latitud,
      lng: stop.longitud,
      address: stop.address,
      employees: [],
      colorIndex: index
    })
  })
  
  // Create a map of employees for quick lookup
  const employeeMap = new Map(
    employees.map(emp => [emp.employee, emp])
  )
  
  // Add employees to their assigned stops
  employees_busStop_assignation.forEach((assignment: any) => {
    const stop = stopMap.get(assignment.cod_bus_stop)
    const employee = employeeMap.get(assignment.employee) as any
    
    if (stop && employee) {
      // Generate mock data only for role and contactInfo, use real department
      const generateMockEmployeeData = (employeeId: string, realDepartment: string) => {
        const roles = ['Manager', 'Developer', 'Designer', 'Analyst', 'Coordinator']
        
        const index = parseInt(employeeId.replace(/\D/g, '')) || 0
        
        return {
          role: roles[index % roles.length],
          department: realDepartment || 'Unknown', // Use real department from instance data
          contactInfo: `${employeeId.toLowerCase()}@company.com`
        }
      }
      
      const mockData = generateMockEmployeeData(employee.employee, employee.department)
      
      stop.employees.push({
        id: employee.employee,
        name: employee.employee,
        address: employee.address,
        ...mockData
      })
    }
  })
  
  return Array.from(stopMap.values())
})

const title = computed(() => t('employees.title'))
const description = computed(() => selectedExecution.value ? selectedExecution.value.name : '')
</script>

<style scoped>
.employees-dashboard-layout {
  display: flex;
  flex-direction: row;
  gap: 2rem;
  flex: 2;
}
.employees-dashboard-map {
  flex: 1;
}
.employees-dashboard-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.employees-dashboard-bottom {
  margin-top: 2rem;
  flex: 1;
}
</style> 