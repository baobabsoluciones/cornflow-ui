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
import { ref } from 'vue'

/**
 * Shared presentational frame for Leaflet-based map charts.
 *
 * Renders the chart-card scaffold (header + title), the map container that
 * Leaflet mounts into, and the loading / error overlays. The map container
 * DOM element is exposed via `defineExpose` so the parent can hand it to
 * Leaflet's `L.map(...)`.
 */
interface Props {
  title: string
  loading?: boolean
  loadingMessage?: string
  error?: string | null
}

withDefaults(defineProps<Props>(), {
  loading: false,
  loadingMessage: '',
  error: null,
})

const mapContainer = ref<HTMLElement | null>(null)

defineExpose({ mapContainer })
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
</style>
