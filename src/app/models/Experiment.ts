import { ExperimentCore } from '@/models/Experiment';
import { Instance } from '@/app/models/Instance';
import { Solution } from '@/app/models/Solution';


export class Experiment extends ExperimentCore{

  constructor(
    instance: Instance, 
    solution: Solution, 
  ) {
    super(instance, solution)
  }

  /**
   * Returns an array of enriched route objects for the map:
   * { cod_route, polyline, stops }
   */
  getEnrichedRoutes() {
    // Get raw data
    const solutionData = this.solution.data as any
    const instanceData = this.instance.data as any

    const resumeRoutes = solutionData.resume_routes || []
    const polylines = solutionData.polylines || []
    const allStops = solutionData.all_stops_sorted_with_dest_in_route || []
    const busStops = (instanceData.busStops || []).reduce((acc, stop) => {
      acc[stop.busStop] = stop
      return acc
    }, {} as Record<string, any>)

    // Group stops by route
    const stopsByRoute: Record<string, any[]> = {}
    for (const stop of allStops) {
      if (!stopsByRoute[stop.cod_route]) stopsByRoute[stop.cod_route] = []
      stopsByRoute[stop.cod_route].push(stop)
    }

    // Build enriched routes
    return resumeRoutes.map((route: any) => {
      // Find polyline for this route
      const polylineObj = polylines.find((p: any) => p.cod_route === route.cod_route)
      // Decode polyline string to array of [lat, lng]
      let polyline: [number, number][] = []
      if (polylineObj && polylineObj.polyline) {
        polyline = decodePolyline(polylineObj.polyline)
      }
      // Build stops array with lat/lng and extra info
      const stops = (stopsByRoute[route.cod_route] || []).map((stop: any) => {
        const busStop = busStops[stop.cod_bus_stop]
        // Find the matching stop info in allStops
        const stopInfo = allStops.find(
          (s: any) => s.cod_route === route.cod_route && s.cod_bus_stop === stop.cod_bus_stop
        )
        return {
          id: stop.cod_bus_stop,
          name: stop.cod_bus_stop,
          lat: busStop ? busStop.latitud : null,
          lng: busStop ? busStop.longitud : null,
          stop_index: stopInfo?.stop_index ?? null,
          horary: stopInfo?.horary ?? null,
          capacity_used: stopInfo?.capacity_used ?? null
        }
      })
      return {
        cod_route: route.cod_route,
        polyline,
        stops
      }
    })
  }
}

// Polyline decoder (Google polyline algorithm)
function decodePolyline(encoded: string): [number, number][] {
  let points: [number, number][] = []
  let index = 0, lat = 0, lng = 0
  while (index < encoded.length) {
    let b, shift = 0, result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1))
    lat += dlat
    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1))
    lng += dlng
    points.push([lat / 1e5, lng / 1e5])
  }
  return points
}