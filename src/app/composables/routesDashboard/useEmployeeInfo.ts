import { computed, type Ref } from 'vue'
import type { EmployeeStop, Employee } from './useEmployeeMap'

export function useEmployeeInfo(stops: Ref<EmployeeStop[]>, selectedStop: Ref<string | null>) {
  const isAllSelected = computed(() => !selectedStop.value || selectedStop.value === 'all')

  const selectedStopInfo = computed(() => {
    if (isAllSelected.value) return null
    return stops.value.find(s => s.id === selectedStop.value)
  })

  const aggregateInfo = computed(() => {
    const totalStops = stops.value.length
    const totalEmployees = stops.value.reduce((sum, stop) => sum + stop.employees.length, 0)
    const averageEmployeesPerStop = totalStops > 0 ? totalEmployees / totalStops : 0
    
    // Calculate role distribution
    const roleDistribution = new Map<string, number>()
    const departmentDistribution = new Map<string, number>()
    
    stops.value.forEach(stop => {
      stop.employees.forEach(employee => {
        // Count roles
        const currentRoleCount = roleDistribution.get(employee.role) || 0
        roleDistribution.set(employee.role, currentRoleCount + 1)
        
        // Count departments
        const currentDeptCount = departmentDistribution.get(employee.department) || 0
        departmentDistribution.set(employee.department, currentDeptCount + 1)
      })
    })

    return {
      totalStops,
      totalEmployees,
      averageEmployeesPerStop,
      roleDistribution: Array.from(roleDistribution.entries()).map(([role, count]) => ({ role, count })),
      departmentDistribution: Array.from(departmentDistribution.entries()).map(([department, count]) => ({ department, count }))
    }
  })

  const selectedStopEmployees = computed(() => {
    if (!selectedStopInfo.value) return []
    return selectedStopInfo.value.employees
  })

  // Generate mock data for employee roles and departments
  const generateMockEmployeeData = (employeeId: string): Pick<Employee, 'role' | 'department' | 'contactInfo'> => {
    const roles = ['Manager', 'Developer', 'Designer', 'Analyst', 'Coordinator']
    const departments = ['Engineering', 'Design', 'Operations', 'Marketing', 'HR']
    
    // Use a deterministic index based on the employee ID to keep consistent mocked data
    const index = parseInt(employeeId.replace(/\D/g, '')) || 0
    
    return {
      role: roles[index % roles.length],
      department: departments[index % departments.length],
      contactInfo: `${employeeId.toLowerCase()}@company.com`
    }
  }

  return {
    isAllSelected,
    selectedStopInfo,
    aggregateInfo,
    selectedStopEmployees,
    generateMockEmployeeData
  }
} 