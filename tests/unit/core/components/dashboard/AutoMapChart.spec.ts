import { describe, test, expect, afterEach, beforeEach, vi } from 'vitest'

// --- Leaflet + asset mocks (declared before importing the component) ---
const { L, mapInstance } = vi.hoisted(() => {
  const mapInstance = {
    setView: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    invalidateSize: vi.fn(),
    fitBounds: vi.fn(),
  }
  const markerInstance = () => ({
    addTo: vi.fn().mockReturnThis(),
    bindPopup: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  })
  const boundsInstance = { extend: vi.fn() }
  const L = {
    map: vi.fn(() => mapInstance),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    marker: vi.fn(() => markerInstance()),
    divIcon: vi.fn(() => ({})),
    icon: vi.fn(() => ({})),
    latLngBounds: vi.fn(() => boundsInstance),
    Marker: { prototype: { options: {} } },
  }
  return { L, mapInstance }
})

vi.mock('leaflet', () => ({ default: L }))
vi.mock('leaflet/dist/leaflet.css', () => ({}))
vi.mock('leaflet/dist/images/marker-icon.png', () => ({ default: 'icon.png' }))
vi.mock('leaflet/dist/images/marker-shadow.png', () => ({
  default: 'shadow.png',
}))
vi.mock('leaflet/dist/images/marker-icon-2x.png', () => ({
  default: 'icon2x.png',
}))
vi.mock('@/assets/styles/dashboard.css', () => ({}))

import AutoMapChart from '@/components/dashboard/AutoMapChart.vue'
import { mountDashboard } from './dashboardTestUtils'

let wrapper: any
afterEach(() => {
  if (wrapper) wrapper.unmount()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.clearAllMocks()
})
beforeEach(() => {
  vi.useFakeTimers()
})

const baseConfig = (over: Record<string, any> = {}) => ({
  coordinates: [
    [40.4, -3.7],
    [41.3, 2.1],
  ] as [number, number][],
  values: [1, 0],
  valueType: 'binary' as const,
  valueColumn: 'active',
  ...over,
})

const mountMap = (config: Record<string, any>, title = 'Map') =>
  mountDashboard(AutoMapChart, { props: { title, config } })

// Run all the queued setTimeouts that onMounted schedules.
const flushMount = async () => {
  await vi.runAllTimersAsync()
}

describe('AutoMapChart', () => {
  test('renders the title and a map container', () => {
    wrapper = mountMap(baseConfig())
    expect(wrapper.find('.chart-title').text()).toBe('Map')
    expect(wrapper.find('.map-container').exists()).toBe(true)
  })

  test('initializes the leaflet map and adds binary markers on mount', async () => {
    wrapper = mountMap(baseConfig())
    await flushMount()
    expect(L.map).toHaveBeenCalled()
    expect(L.tileLayer).toHaveBeenCalled()
    // Two valid coordinates => two markers => fitBounds (more than one).
    expect(L.marker).toHaveBeenCalledTimes(2)
    expect(mapInstance.fitBounds).toHaveBeenCalled()
  })

  test('numeric value type produces gradient marker colors', async () => {
    wrapper = mountMap(
      baseConfig({
        values: [0, 5, 50, 100],
        valueType: 'numeric',
        coordinates: [
          [40, -3],
          [41, -2],
          [42, -1],
          [43, 0],
        ],
      }),
    )
    await flushMount()
    expect(L.marker).toHaveBeenCalledTimes(4)
    expect(L.divIcon).toHaveBeenCalled()
  })

  test('single valid coordinate centers the map with setView', async () => {
    wrapper = mountMap(
      baseConfig({ coordinates: [[40.4, -3.7]], values: [1] }),
    )
    await flushMount()
    expect(L.marker).toHaveBeenCalledTimes(1)
    expect(mapInstance.setView).toHaveBeenCalled()
    expect(mapInstance.fitBounds).not.toHaveBeenCalled()
  })

  test('shows an error when there are no coordinates', async () => {
    wrapper = mountMap(baseConfig({ coordinates: [], values: [] }))
    await flushMount()
    expect(wrapper.find('.map-error-overlay').exists()).toBe(true)
    expect(wrapper.find('.error-text').text()).toBe('No coordinates provided')
  })

  test('shows an error when all coordinates are invalid', async () => {
    wrapper = mountMap(
      baseConfig({ coordinates: [[999, 999]], values: [1] }),
    )
    await flushMount()
    expect(wrapper.find('.map-error-overlay').exists()).toBe(true)
    expect(wrapper.find('.error-text').text()).toBe('No valid coordinates found')
  })

  test('re-adds markers when the config changes', async () => {
    wrapper = mountMap(baseConfig())
    await flushMount()
    const callsAfterMount = L.marker.mock.calls.length
    await wrapper.setProps({
      config: baseConfig({
        coordinates: [[39, -4]],
        values: [1],
      }),
    })
    await flushMount()
    expect(L.marker.mock.calls.length).toBeGreaterThan(callsAfterMount)
  })

  test('removes the map on unmount', async () => {
    wrapper = mountMap(baseConfig())
    await flushMount()
    wrapper.unmount()
    wrapper = null
    expect(mapInstance.remove).toHaveBeenCalled()
  })
})
