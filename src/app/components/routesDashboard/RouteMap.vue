<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
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
  horary?: string
  capacity_used?: number
}

const emit = defineEmits<{
  (e: 'update:selected', value: string | null): void
}>()

const mapRef = ref(null)
const { polylines, markers, mapCenter, mapZoom, updateSelection } = useRouteMap(props.routes, props.selectedRoute)

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
  const mapContainer = document.querySelector('.route-map-container');
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
    </div>
  </InfoCard>
</template>

<style scoped src="@/app/assets/styles/routesDashboard/routesDashboard.css"></style>