import { computed, ref, watchEffect } from 'vue'

export interface Employee {
  id: string
  name: string
  role: string
  department: string
  contactInfo?: string
  address: string
}

export interface EmployeeStop {
  id: string
  name: string
  lat: number
  lng: number
  address: string
  employees: Employee[]
  colorIndex?: number
}

export function useEmployeeMap(stops: EmployeeStop[], selectedStop: string | null) {
  const markers = ref<Array<{ 
    id: string; 
    name: string; 
    latlng: [number, number];
    color: string;
    employeeCount: number;
    address: string;
    employees: Employee[];
  }>>([])
  const mapCenter = ref<[number, number]>([40.4168, -3.7038]) // Default: Madrid
  const mapZoom = ref(12)
  const currentStops = ref(stops)
  const currentSelectedStop = ref(selectedStop)

  function getStopColors(index: number) {
    const colorIndex = (index % 5) + 1
    return {
      color: `var(--route-${colorIndex})`,
      markerColor: `var(--route-${colorIndex}-marker)`
    }
  }

  function updateSelection(newSelectedStop: string | null) {
    currentSelectedStop.value = newSelectedStop
    updateMapData()
  }

  function updateMapData() {
    // Update markers based on selection
    if (!currentSelectedStop.value || currentSelectedStop.value === 'all') {
      // Show all stops
      markers.value = currentStops.value.map((stop, index) => {
        const colors = getStopColors(index)
        return {
          id: stop.id,
          name: stop.name,
          latlng: [stop.lat, stop.lng] as [number, number],
          color: colors.markerColor,
          employeeCount: stop.employees.length,
          address: stop.address,
          employees: stop.employees
        }
      })
    } else {
      // Show only selected stop
      const stop = currentStops.value.find(s => s.id === currentSelectedStop.value)
      const stopIndex = currentStops.value.findIndex(s => s.id === currentSelectedStop.value)
      const colors = getStopColors(stopIndex)
      
      markers.value = stop ? [{
        id: stop.id,
        name: stop.name,
        latlng: [stop.lat, stop.lng] as [number, number],
        color: colors.markerColor,
        employeeCount: stop.employees.length,
        address: stop.address,
        employees: stop.employees
      }] : []
    }

    // Update map center to first stop if available
    if (currentStops.value.length > 0) {
      mapCenter.value = [currentStops.value[0].lat, currentStops.value[0].lng]
    }
  }

  // Initial update
  updateMapData()

  return {
    markers,
    mapCenter,
    mapZoom,
    updateSelection
  }
} 