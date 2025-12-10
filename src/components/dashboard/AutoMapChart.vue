<template>
  <div class="chart-card">
    <div class="chart-header">
      <div class="chart-title">{{ title }}</div>
    </div>
    <div class="chart-content">
      <div ref="mapContainer" class="map-container"></div>
      <div v-if="loading" class="map-loading-overlay">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <div class="loading-text">{{ loadingMessage }}</div>
        </div>
      </div>
      <div v-if="error" class="map-error-overlay">
        <div class="error-text">{{ error }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@/assets/styles/dashboard.css'

// Fix for default marker icons in Leaflet with Vite
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png'

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconRetinaUrl: iconRetina,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

L.Marker.prototype.options.icon = DefaultIcon

interface Props {
  title: string
  config: {
    coordinates: [number, number][] // Array of [lat, lon] pairs
    values: number[]
    valueType: 'binary' | 'numeric'
    valueColumn: string
  }
}

const props = defineProps<Props>()

const mapContainer = ref<HTMLElement | null>(null)
const map = ref<L.Map | null>(null)
const markers = ref<L.Marker[]>([])
const loading = ref(false)
const loadingMessage = ref('Initializing map...')
const error = ref<string | null>(null)

/**
 * Get color for marker based on value
 */
function getMarkerColor(value: number, valueType: 'binary' | 'numeric', maxValue: number): string {
  if (valueType === 'binary') {
    // Green for 1, red for 0
    return value >= 1 ? '#3ba780' : '#dc3545'
  } else {
    // Gradient from light blue to dark blue based on value
    const ratio = maxValue > 0 ? value / maxValue : 0
    if (ratio === 0) return '#dc3545' // Red for zero
    if (ratio < 0.33) return '#4db3d0' // Light blue
    if (ratio < 0.66) return '#0984c6' // Medium blue
    return '#014b5b' // Dark blue
  }
}

/**
 * Create custom marker icon with color
 */
function createMarkerIcon(color: string): L.Icon {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}


/**
 * Initialize map immediately (show map tiles right away)
 */
function initializeMapBase() {
  if (!mapContainer.value) {
    console.error('Map container not found')
    error.value = 'Map container not available'
    return false
  }

  try {
    // Initialize map centered on Spain (default for Spanish cities)
    map.value = L.map(mapContainer.value, {
      center: [40.4168, -3.7038], // Madrid, Spain
      zoom: 6,
      zoomControl: true,
    })

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map.value)

    // Force map to recalculate size
    setTimeout(() => {
      if (map.value) {
        map.value.invalidateSize()
      }
    }, 100)

    return true
  } catch (err) {
    console.error('Error initializing map base:', err)
    error.value = `Failed to initialize map: ${err instanceof Error ? err.message : 'Unknown error'}`
    return false
  }
}

/**
 * Add markers to map using coordinates directly
 */
async function addMarkersToMap() {
  if (!map.value) {
    console.error('Map not initialized')
    return
  }

  // Check if config is valid
  if (!props.config || !props.config.coordinates || props.config.coordinates.length === 0) {
    console.error('Invalid map config:', props.config)
    error.value = 'No coordinates provided'
    loading.value = false
    return
  }

  loading.value = true
  loadingMessage.value = 'Adding markers...'
  error.value = null

  try {
    // Validate coordinates and values
    const coordinateData = props.config.coordinates
      .map((coords, index) => ({
        coords: coords as [number, number],
        value: props.config.values[index] || 0,
      }))
      .filter((item) => {
        const [lat, lon] = item.coords
        return (
          !isNaN(lat) &&
          !isNaN(lon) &&
          lat >= -90 &&
          lat <= 90 &&
          lon >= -180 &&
          lon <= 180
        )
      })

    if (coordinateData.length === 0) {
      error.value = 'No valid coordinates found'
      loading.value = false
      return
    }

    const maxValue = Math.max(...props.config.values, 0)

    // Add markers to map
    const bounds: L.LatLngBounds = L.latLngBounds([])

    coordinateData.forEach(({ coords, value }) => {
      const color = getMarkerColor(value, props.config.valueType, maxValue)
      const marker = L.marker(coords, {
        icon: createMarkerIcon(color),
      })

      // Create popup with coordinates and value info
      const popupContent = `
        <div style="text-align: center; padding: 4px;">
          <strong>${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}</strong><br/>
          ${props.config.valueColumn}: <strong>${value}</strong>
        </div>
      `
      marker.bindPopup(popupContent)

      marker.addTo(map.value!)
      markers.value.push(marker)
      bounds.extend(coords)
    })

    // Fit map to show all markers
    if (coordinateData.length > 1) {
      map.value.fitBounds(bounds, { padding: [50, 50] })
    } else if (coordinateData.length === 1) {
      // If only one marker, center on it with a reasonable zoom
      map.value.setView(coordinateData[0].coords, 10)
    }

    // Force map to recalculate size after adding markers
    setTimeout(() => {
      if (map.value) {
        map.value.invalidateSize()
      }
    }, 100)

    console.log(`Successfully added ${coordinateData.length} markers`)
    loading.value = false
  } catch (err) {
    console.error('Error adding markers:', err)
    error.value = `Failed to add markers: ${err instanceof Error ? err.message : 'Unknown error'}`
    loading.value = false
  }
}

/**
 * Initialize map and add markers
 */
async function initializeMap() {
  // First, initialize the map base (show tiles immediately)
  if (!initializeMapBase()) {
    return
  }

  // Then, geocode and add markers (this takes time)
  await addMarkersToMap()
}

// Watch for config changes
watch(
  () => props.config,
  async () => {
    if (map.value) {
      // Clear existing markers
      markers.value.forEach((marker) => marker.remove())
      markers.value = []
    }
    
    // Re-add markers with new config
    await addMarkersToMap()
  },
  { deep: true },
)

onMounted(async () => {
  // Wait for DOM to be ready
  await nextTick()
  // Small delay to ensure the container is fully rendered
  setTimeout(() => {
    initializeMap()
  }, 200)
})

onBeforeUnmount(() => {
  if (map.value) {
    map.value.remove()
    map.value = null
  }
  markers.value = []
})
</script>

<style scoped>
.chart-content {
  position: relative;
}

.map-container {
  width: 100%;
  height: 300px;
  min-height: 300px;
  border-radius: 8px;
  overflow: hidden;
}

.map-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  z-index: 1000;
}

.map-error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  z-index: 1001;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(9, 132, 198, 0.2);
  border-top-color: var(--primary, #0984c6);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: var(--subtitle, #666);
  font-size: 14px;
  text-align: center;
}

.error-text {
  color: var(--danger, #dc3545);
  font-size: 14px;
  text-align: center;
  padding: 16px;
}

:deep(.custom-marker) {
  background: transparent;
  border: none;
}
</style>

