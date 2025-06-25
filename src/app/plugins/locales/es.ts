export default {
  routes: {
    title: 'Rutas'
  },
  employees: {
    title: 'Empleados'
  },
  routesDashboard: {
    filterSelector: {
      placeholder: 'Selecciona una ruta o todas las rutas',
      label: 'Ruta seleccionada',
      hint: 'Selecciona la ruta que deseas ver',
      all: 'Todas las rutas',
      route: 'Ruta'
    },
    map: {
      placeholder: 'El mapa se mostrará aquí',
      startTime: 'Hora de salida',
      employees: 'Empleados',
      stopName: 'Nombre de la parada'
    },
    globalInfo: {
      placeholder: 'La información global de la ruta se mostrará aquí'
    },
    stopsHorizontal: {
      title: 'Paradas',
      duration: 'Duración',
      capacity: 'Capacidad',
      placeholder: 'Las paradas de la ruta seleccionada se mostrarán aquí'
    },
    allRoutesHorizontal: {
      title: 'Vista General de Todas las Rutas',
      placeholder: 'Todas las rutas se mostrarán aquí',
      stops: 'Paradas',
      capacity: 'Capacidad',
      time: 'Tiempo',
      duration: 'Duración',
      distance: 'Distancia'
    }
  },
  employeesDashboard: {
    filterSelector: {
      placeholder: 'Selecciona una parada o todas las paradas',
      label: 'Parada seleccionada',
      hint: 'Selecciona la parada que deseas ver',
      all: 'Todas las paradas',
      stop: 'Parada'
    },
    map: {
      placeholder: 'El mapa se mostrará aquí',
      stopName: 'Nombre de la parada',
      employees: 'Empleados',
      employeeCount: 'Número de empleados',
      pickupTime: 'Hora de recogida',
      title: 'Mapa de paradas de empleados'
    },
    globalInfo: {
      placeholder: 'La información de empleados se mostrará aquí',
      totalEmployees: 'Total de empleados',
      totalStops: 'Total de paradas',
      averageEmployeesPerStop: 'Promedio de empleados por parada',
      employeeDistribution: 'Distribución de empleados'
    },
    employeeList: {
      title: 'Empleados por parada',
      placeholder: 'Selecciona una parada para ver los empleados asignados',
      name: 'Nombre',
      role: 'Cargo',
      department: 'Departamento',
      contactInfo: 'Contacto',
      pickupTime: 'Hora de recogida'
    },
    allStopsHorizontal: {
      title: 'Vista general',
      placeholder: 'Todas las paradas se mostrarán aquí',
      employees: 'Empleados',
      location: 'Ubicación',
      pickupTime: 'Hora de recogida'
    }
  }
}
