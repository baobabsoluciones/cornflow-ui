export default {
  routes: {
    title: 'Itinéraires'
  },
  employees: {
    title: 'Employés'
  },
  routesDashboard: {
    filterSelector: {
      placeholder: 'Sélectionnez un itinéraire ou tous les itinéraires',
      label: 'Itinéraire',
      hint: 'Sélectionnez l\'itinéraire que vous souhaitez voir',
      all: 'Tous les itinéraires',
      route: 'Itinéraire'
    },
    map: {
      placeholder: 'La carte sera affichée ici',
      startTime: 'Heure de départ',
      employees: 'Employés',
      stopName: 'Nom de l\'arrêt'
    },
    globalInfo: {
      placeholder: 'Les informations globales de l\'itinéraire seront affichées ici'
    },
    stopsHorizontal: {
      title: 'Arrêts',
      duration: 'Durée',
      capacity: 'Capacité',
      placeholder: 'Les arrêts de l\'itinéraire sélectionné seront affichés ici'
    },
    allRoutesHorizontal: {
      title: 'Vue d\'ensemble de tous les itinéraires',
      placeholder: 'Tous les itinéraires seront affichés ici',
      stops: 'Arrêts',
      capacity: 'Capacité',
      time: 'Temps',
      duration: 'Durée',
      distance: 'Distance'
    }
  },
  employeesDashboard: {
    filterSelector: {
      placeholder: 'Sélectionnez un arrêt ou tous les arrêts',
      label: 'Arrêt sélectionné',
      hint: 'Sélectionnez l\'arrêt que vous souhaitez voir',
      all: 'Tous les arrêts',
      stop: 'Arrêt'
    },
    map: {
      placeholder: 'La carte sera affichée ici',
      stopName: 'Nom de l\'arrêt',
      employees: 'Employés',
      employeeCount: 'Nombre d\'employés',
      pickupTime: 'Heure de ramassage',
      title: 'Carte des Arrêts des Employés'
    },
    globalInfo: {
      placeholder: 'Les informations sur les employés seront affichées ici',
      totalEmployees: 'Total des employés',
      totalStops: 'Total des arrêts',
      averageEmployeesPerStop: 'Moyenne d\'employés par arrêt',
      employeeDistribution: 'Distribution des employés'
    },
    employeeList: {
      title: 'Employés à l\'arrêt',
      placeholder: 'Sélectionnez un arrêt pour voir les employés assignés',
      name: 'Nom',
      role: 'Rôle',
      department: 'Département',
      contactInfo: 'Contact',
      pickupTime: 'Heure de ramassage'
    },
    allStopsHorizontal: {
      title: 'Vue d\'ensemble de tous les arrêts',
      placeholder: 'Tous les arrêts seront affichés ici',
      employees: 'Employés',
      location: 'Emplacement',
      pickupTime: 'Heure de ramassage'
    }
  }
}
