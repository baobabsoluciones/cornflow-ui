<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed } from 'vue'
import { LMap, LTileLayer, LPolyline, LMarker, LPopup } from '@vue-leaflet/vue-leaflet'
import 'leaflet/dist/leaflet.css'
import '@/app/assets/styles/routesDashboard/routesDashboard.css'
import { useRouteMap, Route } from '@/app/composables/routesDashboard/useRouteMap'
import L from 'leaflet'
import InfoCard from '@/app/components/shared/InfoCard.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  routes: Route[]
  selectedRoute: string | null
}>()

type MarkerType = {
  id: string
  name: string
  latlng: [number, number]
  color: string
  order: number
  address?: string
  horary?: string
  capacity_used?: number
}

const emit = defineEmits<{
  (e: 'update:selected', value: string | null): void
}>()

const mapRef = ref(null)
const { polylines, markers, mapCenter, mapZoom, updateSelection } = useRouteMap(props.routes, props.selectedRoute)

// Calculate bounds for all visible data (polylines and markers)
const calculateBounds = () => {
  const bounds = L.latLngBounds([])
  let hasData = false
  
  // Add polyline points to bounds
  polylines.value.forEach(polyline => {
    if (polyline.latlngs && polyline.latlngs.length > 0) {
      polyline.latlngs.forEach(point => {
        bounds.extend(point)
        hasData = true
      })
    }
  })
  
  // Add marker points to bounds
  markers.value.forEach(marker => {
    bounds.extend(marker.latlng)
    hasData = true
  })
  
  return hasData ? bounds : null
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

function createCustomIcon(color: string, order: number) {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="marker-container">
        <svg width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="13" fill="#fff" stroke="${color}" stroke-width="3"/>
          <text x="16" y="22" text-anchor="middle" font-size="16" font-family="Arial, sans-serif" font-weight="bold" fill="#222">${order}</text>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  })
}

// Watch for changes in props and update the composable
watch(
  () => props.selectedRoute,
  (newValue) => {
    updateSelection(newValue)
  }
)

watch(
  () => props.routes,
  (newValue) => {
    updateSelection(props.selectedRoute)
  }
)

// Auto-fit bounds when data changes
watch([polylines, markers], () => {
  nextTick(() => {
    fitMapToBounds()
  })
}, { deep: true })

function handleRouteClick(routeId: string) {
  emit('update:selected', routeId)
}

watch(
  [() => props.selectedRoute, () => props.routes],
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
  const mapContainer = document.querySelector('.route-map-container');
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
  <InfoCard title="Map Overview">
    <div class="route-map-container">
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
        <LPolyline
          v-for="poly in polylines"
          :key="poly.id"
          :lat-lngs="poly.latlngs"
          :color="poly.color"
          :weight="poly.selected ? 6 : 4"
          @click="handleRouteClick(poly.id)"
        />
        <LMarker
          v-for="marker in markers as MarkerType[]"
          :key="marker.id"
          :lat-lng="marker.latlng"
          :icon="createCustomIcon(marker.color, marker.order)"
        >
          <LPopup>
            <div class="popup-card">
              <div class="popup-header">
                <span class="popup-order" :style="{ background: marker.color }">{{ marker.order }}</span>
                <span class="popup-title">{{ marker.name }}</span>
              </div>
              <div class="popup-divider" :style="{ background: marker.color }"></div>
              <div class="popup-row" v-if="marker.address">
                <span class="mdi mdi-map-marker-outline popup-icon" :style="{ color: marker.color }"></span>
                <span class="popup-label">{{ t('routesDashboard.map.address', 'Address') }}:</span>
                <span class="popup-value">{{ marker.address }}</span>
              </div>
              <div class="popup-row">
                <span class="mdi mdi-clock-outline popup-icon" :style="{ color: marker.color }"></span>
                <span class="popup-label">{{ t('routesDashboard.map.startTime') }}:</span>
                <span class="popup-value">{{ marker.horary }}</span>
              </div>
              <div class="popup-row">
                <span class="mdi mdi-account-group-outline popup-icon" :style="{ color: marker.color }"></span>
                <span class="popup-label">{{ t('routesDashboard.map.employees') }}:</span>
                <span class="popup-value">{{ marker.capacity_used }}</span>
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
.route-map-container {
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

/* Custom marker styles */
:deep(.custom-marker) {
  background: none;
  border: none;
}

.marker-container {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>