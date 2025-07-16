<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed } from 'vue'
import { LMap, LTileLayer, LMarker, LPopup } from '@vue-leaflet/vue-leaflet'
import 'leaflet/dist/leaflet.css'
import '@/app/assets/styles/routesDashboard/routesDashboard.css'
import { useEmployeeMap, type EmployeeStop, type Employee } from '@/app/composables/routesDashboard/useEmployeeMap'
import L from 'leaflet'
import InfoCard from '@/app/components/shared/InfoCard.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  stops: EmployeeStop[]
  selectedStop: string | null
}>()

type MarkerType = {
  id: string
  name: string
  latlng: [number, number]
  color: string
  employeeCount: number
  pickupTime: string
  employees: any[]
  address: string
}

type EmployeeMarkerType = {
  id: string
  name: string
  latlng: [number, number]
  color: string
  employee: Employee
}

const emit = defineEmits<{
  (e: 'update:selected', value: string | null): void
  (e: 'employee-click', value: Employee): void
}>()

const mapRef = ref(null)
const { markers, mapCenter, mapZoom, updateSelection } = useEmployeeMap(props.stops, props.selectedStop)

// Check if a specific stop is selected (not 'all')
const isSpecificStopSelected = computed(() => {
  return props.selectedStop && props.selectedStop !== 'all'
})

// Get employee markers for the selected stop
const employeeMarkers = computed((): EmployeeMarkerType[] => {
  if (!isSpecificStopSelected.value) return []
  
  const selectedStopData = props.stops.find(stop => stop.id === props.selectedStop)
  if (!selectedStopData) return []
  
  // Get stop color
  const stopIndex = props.stops.findIndex(stop => stop.id === props.selectedStop)
  const colorIndex = (stopIndex % 5) + 1
  const color = `var(--route-${colorIndex}-marker)`
  
  // Create markers for each employee around the stop location
  return selectedStopData.employees.map((employee, index) => {
    // Create a small offset around the stop location for each employee
    const offsetDistance = 0.001 // Small offset in degrees
    const angle = (index * 360 / selectedStopData.employees.length) * (Math.PI / 180)
    const offsetLat = selectedStopData.lat + (offsetDistance * Math.cos(angle))
    const offsetLng = selectedStopData.lng + (offsetDistance * Math.sin(angle))
    
    return {
      id: `employee-${employee.id}`,
      name: employee.name,
      latlng: [offsetLat, offsetLng] as [number, number],
      color,
      employee
    }
  })
})

// Calculate bounds for all visible markers
const calculateBounds = () => {
  const allMarkers = [...markers.value, ...employeeMarkers.value]
  if (allMarkers.length === 0) return null
  
  const bounds = L.latLngBounds([])
  allMarkers.forEach(marker => {
    bounds.extend(marker.latlng)
  })
  
  return bounds
}

// Fit map to show all data
const fitMapToBounds = () => {
  if (!mapRef.value?.leafletObject) return
  
  const bounds = calculateBounds()
  if (!bounds || bounds.getCenter().equals(new L.LatLng(0, 0))) return
  
  try {
    mapRef.value.leafletObject.fitBounds(bounds, {
      padding: [20, 20],
      maxZoom: 15
    })
  } catch (error) {
    console.warn('Could not fit bounds:', error)
  }
}

// Recenter button handler
const recenterMap = () => {
  fitMapToBounds()
}

function createCustomIcon(color: string, employeeCount: number) {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="marker-container">
        <svg width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="16" fill="#fff" stroke="${color}" stroke-width="3"/>
          <text x="20" y="26" text-anchor="middle" font-size="14" font-family="Arial, sans-serif" font-weight="bold" fill="#222">${employeeCount}</text>
        </svg>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  })
}

function createEmployeeIcon(color: string) {
  return L.divIcon({
    className: 'employee-marker',
    html: `
      <div class="employee-marker-container">
        <svg width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="14" fill="#fff" stroke="${color}" stroke-width="2"/>
          <path d="M16 8c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.8-4 4-4zm-6 16c0-4 2.7-6 6-6s6 2 6 6" 
                fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  })
}

// Watch for changes in props and update the composable
watch(
  () => props.selectedStop,
  (newValue) => {
    updateSelection(newValue)
  }
)

watch(
  () => props.stops,
  (newValue) => {
    updateSelection(props.selectedStop)
  }
)

// Auto-fit bounds when markers change
watch([markers, employeeMarkers], () => {
  nextTick(() => {
    fitMapToBounds()
  })
}, { deep: true })

function handleStopClick(stopId: string) {
  emit('update:selected', stopId)
}

function handleEmployeeClick(employee: Employee) {
  emit('employee-click', employee)
}

watch(
  [() => props.selectedStop, () => props.stops],
  () => {
    console.log('invalidateSize')
    setTimeout(() => {
      if (mapRef.value && mapRef.value.leafletObject) {
        mapRef.value.leafletObject.invalidateSize();
        fitMapToBounds()
      }
    }, 200);
  }
);

onMounted(() => {
  // Create a resize observer to handle container size changes
  const resizeObserver = new ResizeObserver(() => {
    if (mapRef.value && mapRef.value.leafletObject) {
      mapRef.value.leafletObject.invalidateSize();
      setTimeout(() => fitMapToBounds(), 100)
    }
  });

  // Observe the map container
  const mapContainer = document.querySelector('.employee-map-container');
  if (mapContainer) {
    resizeObserver.observe(mapContainer);
  }

  // Initial size check and fit bounds after a short delay to ensure DOM is ready
  nextTick(() => {
    if (mapRef.value && mapRef.value.leafletObject) {
      mapRef.value.leafletObject.invalidateSize();
      setTimeout(() => fitMapToBounds(), 300)
    }
  });
});
</script>

<template>
  <InfoCard :title="t('employeesDashboard.map.title')">
    <div class="employee-map-container">
      <LMap
        ref="mapRef"
        :zoom="mapZoom"
        :center="mapCenter"
        style="height: 100%; width: 100%"
      >
        <LTileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        />
        
        <!-- Stop markers -->
        <LMarker
          v-for="marker in markers as MarkerType[]"
          :key="marker.id"
          :lat-lng="marker.latlng"
          :icon="createCustomIcon(marker.color, marker.employeeCount)"
          @click="handleStopClick(marker.id)"
        >
          <LPopup>
            <div class="popup-card">
              <div class="popup-header">
                <span class="popup-order" :style="{ background: marker.color }">{{ marker.employeeCount }}</span>
                <span class="popup-title">{{ marker.name }}</span>
              </div>
              <div class="popup-divider" :style="{ background: marker.color }"></div>
              <div class="popup-row">
                <span class="mdi mdi-map-marker-outline popup-icon" :style="{ color: marker.color }"></span>
                <span class="popup-label">{{ t('employeesDashboard.map.address', 'Address') }}:</span>
                <span class="popup-value">{{ marker.address }}</span>
              </div>
              <div class="popup-row">
                <span class="mdi mdi-account-group-outline popup-icon" :style="{ color: marker.color }"></span>
                <span class="popup-label">{{ t('employeesDashboard.map.employees') }}:</span>
                <span class="popup-value">{{ marker.employeeCount }}</span>
              </div>
            </div>
          </LPopup>
        </LMarker>

        <!-- Employee markers (only when specific stop is selected) -->
        <LMarker
          v-for="employeeMarker in employeeMarkers"
          :key="employeeMarker.id"
          :lat-lng="employeeMarker.latlng"
          :icon="createEmployeeIcon(employeeMarker.color)"
          @click="handleEmployeeClick(employeeMarker.employee)"
        >
          <LPopup>
            <div class="popup-card employee-popup">
              <div class="popup-header">
                <span class="mdi mdi-account popup-employee-icon" :style="{ color: employeeMarker.color }"></span>
                <span class="popup-title">{{ employeeMarker.employee.name }}</span>
              </div>
              <div class="popup-divider" :style="{ background: employeeMarker.color }"></div>
              <div class="popup-row">
                <span class="mdi mdi-briefcase-outline popup-icon" :style="{ color: employeeMarker.color }"></span>
                <span class="popup-label">{{ t('employeesDashboard.employee.role', 'Role') }}:</span>
                <span class="popup-value">{{ employeeMarker.employee.role }}</span>
              </div>
              <div class="popup-row">
                <span class="mdi mdi-domain popup-icon" :style="{ color: employeeMarker.color }"></span>
                <span class="popup-label">{{ t('employeesDashboard.employee.department', 'Department') }}:</span>
                <span class="popup-value">{{ employeeMarker.employee.department }}</span>
              </div>
              <div class="popup-row">
                <span class="mdi mdi-map-marker-outline popup-icon" :style="{ color: employeeMarker.color }"></span>
                <span class="popup-label">{{ t('employeesDashboard.employee.address', 'Address') }}:</span>
                <span class="popup-value">{{ employeeMarker.employee.address }}</span>
              </div>
              <div class="popup-row" v-if="employeeMarker.employee.contactInfo">
                <span class="mdi mdi-email-outline popup-icon" :style="{ color: employeeMarker.color }"></span>
                <span class="popup-label">{{ t('employeesDashboard.employee.contact', 'Contact') }}:</span>
                <span class="popup-value">{{ employeeMarker.employee.contactInfo }}</span>
              </div>
            </div>
          </LPopup>
        </LMarker>
      </LMap>

      <!-- Recenter button -->
      <button 
        class="recenter-button"
        @click="recenterMap"
        :title="t('map.recenter', 'Recenter map')"
      >
        <span class="mdi mdi-crosshairs-gps"></span>
      </button>
    </div>
  </InfoCard>
</template>

<style scoped>
.employee-map-container {
  height: 400px;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.recenter-button {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
  background: white;
  border: 2px solid rgba(0,0,0,0.2);
  border-radius: 4px;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  transition: all 0.2s ease;
}

.recenter-button:hover {
  background: #f4f4f4;
  border-color: rgba(0,0,0,0.4);
}

.recenter-button:active {
  transform: scale(0.95);
}

.recenter-button .mdi {
  font-size: 18px;
  color: #333;
}

.popup-card {
  min-width: 200px;
  padding: 8px;
}

.employee-popup {
  min-width: 250px;
}

.popup-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.popup-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: white;
  font-weight: bold;
  font-size: 12px;
}

.popup-employee-icon {
  font-size: 20px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.popup-title {
  font-weight: bold;
  font-size: 14px;
}

.popup-divider {
  height: 2px;
  margin: 8px 0;
  border-radius: 1px;
}

.popup-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 12px;
}

.popup-icon {
  font-size: 14px;
  width: 16px;
}

.popup-label {
  color: #666;
  flex: 1;
}

.popup-value {
  font-weight: 600;
  color: #333;
}

/* Custom marker styles */
:deep(.custom-marker) {
  background: none;
  border: none;
}

:deep(.employee-marker) {
  background: none;
  border: none;
}

.marker-container,
.employee-marker-container {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style> 