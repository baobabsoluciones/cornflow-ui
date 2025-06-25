<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { LMap, LTileLayer, LMarker, LPopup } from '@vue-leaflet/vue-leaflet'
import 'leaflet/dist/leaflet.css'
import '@/app/assets/styles/routesDashboard/routesDashboard.css'
import { useEmployeeMap, type EmployeeStop } from '@/app/composables/routesDashboard/useEmployeeMap'
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

const emit = defineEmits<{
  (e: 'update:selected', value: string | null): void
}>()

const mapRef = ref(null)
const { markers, mapCenter, mapZoom, updateSelection } = useEmployeeMap(props.stops, props.selectedStop)

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

function handleStopClick(stopId: string) {
  emit('update:selected', stopId)
}

watch(
  [() => props.selectedStop, () => props.stops],
  () => {
    console.log('invalidateSize')
    setTimeout(() => {
      if (mapRef.value && mapRef.value.leafletObject) {
        mapRef.value.leafletObject.invalidateSize();
      }
    }, 200);
  }
);

onMounted(() => {
  // Create a resize observer to handle container size changes
  const resizeObserver = new ResizeObserver(() => {
    if (mapRef.value && mapRef.value.leafletObject) {
      mapRef.value.leafletObject.invalidateSize();
    }
  });

  // Observe the map container
  const mapContainer = document.querySelector('.employee-map-container');
  if (mapContainer) {
    resizeObserver.observe(mapContainer);
  }

  // Initial size check after a short delay to ensure DOM is ready
  nextTick(() => {
    if (mapRef.value && mapRef.value.leafletObject) {
      mapRef.value.leafletObject.invalidateSize();
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
      </LMap>
    </div>
  </InfoCard>
</template>

<style scoped>
.employee-map-container {
  height: 400px;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
}

.popup-card {
  min-width: 200px;
  padding: 8px;
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
</style> 