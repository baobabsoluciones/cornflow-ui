import { computed, ref, watchEffect } from 'vue'

export interface Route {
  cod_route: string
  polyline: [number, number][]
  stops?: Array<{ id: string; name: string; lat: number; lng: number; horary: string; capacity_used: number }>
  colorIndex?: number
}

export function useRouteMap(routes: Route[], selectedRoute: string | null) {
  const polylines = ref<Array<{ 
    id: string; 
    latlngs: [number, number][]; 
    selected: boolean;
    color: string;
    markerColor: string;
  }>>([])
  const markers = ref<Array<{ 
    id: string; 
    name: string; 
    latlng: [number, number];
    color: string;
    order: number;
    horary: string;
    capacity_used: number;
  }>>([])
  const mapCenter = ref<[number, number]>([40.4168, -3.7038]) // Default: Madrid
  const mapZoom = ref(12)
  const currentRoutes = ref(routes)
  const currentSelectedRoute = ref(selectedRoute)

  function getRouteColors(index: number) {
    const colorIndex = (index % 5) + 1
    return {
      color: `var(--route-${colorIndex})`,
      markerColor: `var(--route-${colorIndex}-marker)`
    }
  }

  function updateSelection(newSelectedRoute: string | null) {
    currentSelectedRoute.value = newSelectedRoute
    updateMapData()
  }

  function updateMapData() {
    // Update polylines
    if (!currentSelectedRoute.value || currentSelectedRoute.value === 'all') {
      polylines.value = currentRoutes.value.map((route, index) => {
        const colors = getRouteColors(index)
        return {
          id: route.cod_route,
          latlngs: route.polyline,
          selected: false,
          color: colors.color,
          markerColor: colors.markerColor
        }
      })
    } else {
      const selectedRouteIndex = currentRoutes.value.findIndex(r => r.cod_route === currentSelectedRoute.value)
      polylines.value = currentRoutes.value
        .filter(route => route.cod_route === currentSelectedRoute.value)
        .map(route => {
          const colors = getRouteColors(selectedRouteIndex)
          return {
            id: route.cod_route,
            latlngs: route.polyline,
            selected: true,
            color: colors.color,
            markerColor: colors.markerColor
          }
        })
    }

    // Update markers
    if (!currentSelectedRoute.value || currentSelectedRoute.value === 'all') {
      markers.value = currentRoutes.value.flatMap((route, routeIndex) => {
        const colors = getRouteColors(routeIndex)
        return (route.stops || []).map((stop, stopIndex) => ({
          id: `${route.cod_route}-${stop.id}`,
          name: stop.name,
          latlng: [stop.lat, stop.lng] as [number, number],
          color: colors.markerColor,
          order: stopIndex + 1,
          horary: stop.horary,
          capacity_used: stop.capacity_used
        }))
      })
    } else {
      const route = currentRoutes.value.find(r => r.cod_route === currentSelectedRoute.value)
      const routeIndex = currentRoutes.value.findIndex(r => r.cod_route === currentSelectedRoute.value)
      const colors = getRouteColors(routeIndex)
      markers.value = route?.stops?.map((stop, stopIndex) => ({
        id: stop.id,
        name: stop.name,
        latlng: [stop.lat, stop.lng] as [number, number],
        color: colors.markerColor,
        order: stopIndex + 1,
        horary: stop.horary,
        capacity_used: stop.capacity_used
      })) || []
    }

    // Update map center
    if (currentRoutes.value.length && currentRoutes.value[0].polyline.length) {
      mapCenter.value = currentRoutes.value[0].polyline[Math.floor(currentRoutes.value[0].polyline.length / 2)]
    }
  }

  // Initial update
  updateMapData()

  return {
    polylines,
    markers,
    mapCenter,
    mapZoom,
    updateSelection
  }
} 