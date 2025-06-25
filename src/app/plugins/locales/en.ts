export default {
  routes: {
    title: 'Routes'
  },
  employees: {
    title: 'Employees'
  },
  routesDashboard: {
    filterSelector: {
      placeholder: 'Select a route or all routes',
      label: 'Route selected',
      hint: 'Select the route you want to view',
      all: 'All routes',
      route: 'Route'
    },
    map: {
      placeholder: 'Map will be displayed here',
      startTime: 'Start time',
      employees: 'Employees',
      stopName: 'Stop name'
    },
    globalInfo: {
      placeholder: 'Route global information will be shown here'
    },
    stopsHorizontal: {
      title: 'Stops',
      duration: 'Duration',
      capacity: 'Capacity',
      placeholder: 'Stops for the selected route will be shown here'
    },
    allRoutesHorizontal: {
      title: 'All Routes Overview',
      placeholder: 'All routes will be shown here',
      stops: 'Stops',
      capacity: 'Capacity',
      time: 'Time',
      duration: 'Duration',
      distance: 'Distance'
    }
  },
  employeesDashboard: {
    filterSelector: {
      placeholder: 'Select a stop or all stops',
      label: 'Stop selected',
      hint: 'Select the stop you want to view',
      all: 'All stops',
      stop: 'Stop'
    },
    map: {
      placeholder: 'Map will be displayed here',
      stopName: 'Stop name',
      employees: 'Employees',
      employeeCount: 'Employee count',
      title: 'Employee stops map'
    },
    globalInfo: {
      placeholder: 'Employee information will be shown here',
      totalEmployees: 'Total employees',
      totalStops: 'Total stops',
      averageEmployeesPerStop: 'Average employees per stop',
      employeeDistribution: 'Employee distribution'
    },
    employeeList: {
      title: 'Employees at stop',
      placeholder: 'Select a stop to view assigned employees',
      name: 'Name',
      role: 'Role',
      department: 'Department',
      contactInfo: 'Contact',
      pickupTime: 'Pickup time'
    },
    allStopsHorizontal: {
      title: 'All stops overview',
      placeholder: 'All stops will be shown here',
      employees: 'Employees',
      location: 'Location',
      pickupTime: 'Pickup time'
    }
  }
}
