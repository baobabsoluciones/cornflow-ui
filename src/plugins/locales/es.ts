export default {
  projectExecution: {
    title: 'Ejecución del proyecto',
    description:
      'Crea una nueva ejecución o carga una existente para visualizar la solución que estás buscando. Para hacerlo, sigue los pasos a continuación:',
    continueButton: 'Continuar',
    previousButton: 'Anterior',
    snackbar: {
      successCreate: 'Ejecución creada con éxito',
      errorCreate: 'Ocurrió un error al crear la ejecución',
      succesSearch: 'Búsqueda completada con éxito',
      errorSearch: 'Ocurrió un error al buscar ejecuciones',
      noDataSearch:
        'No se encontraron ejecuciones en el intervalo seleccionado',
      successDelete: 'Ejecución eliminada con éxito',
      errorDelete: 'Ocurrió un error al eliminar la ejecución',
      successLoad: 'Ejecución cargada con éxito',
      errorLoad: 'Ocurrió un error al cargar la ejecución',
    },
    steps: {
      step1: {
        title: 'Nueva ejecución',
        description: 'Crear una nueva ejecución',
        titleContent: 'Elige una',
        firstOption: {
          title: 'Crear una nueva ejecución',
          description:
            'Se creará una nueva ejecución para la cual se deberá cargar una nueva instancia de la tabla de datos de entrada con la estructura correcta.',
        },
        secondOption: {
          title: 'Buscar y cargar una ejecución existente',
          description:
            'Busca por fecha una ejecución existente y cárgala para verla.',
        },
      },
      step2Search: {
        title: 'Seleccionar fechas',
        description: 'Selecciona las fechas para buscar una ejecución',
        titleContent: 'Selecciona las fechas',
        subtitleContent:
          'Elige una fecha de inicio y una fecha de fin para buscar ejecuciones dentro del intervalo entre ellas',
        startDate: 'Fecha de inicio',
        endDate: 'Fecha de fin',
        search: 'Buscar',
      },
      step2: {
        title: 'Cargar instancia',
        description: 'Carga un archivo con los datos de la instancia',
        titleContent: 'Cargar instancia',
        subtitleContent:
          'Selecciona un archivo para cargar los datos de la instancia',
        loadInstance: {
          dragAndDropDescription:
            'Arrastra y suelta tu archivo de instancia aquí',
          uploadFile: 'Subir archivo',
          noSchemaError:
            'No se encontró ningún esquema: ¿estás conectado al servidor?',
          instanceSchemaError: 'La instancia no cumple con el esquema',
          instanceLoaded: 'Instancia cargada con éxito',
          invalidFileFormat:
            'Formato de archivo no válido. Inténtalo de nuevo.',
          unexpectedError: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
        },
      },
      step3: {
        title: 'Seleccionar solucionador',
        description: 'Selecciona el solucionador a usar para la ejecución',
        titleContent: 'Selecciona un solucionador',
        subtitleContent:
          'El solucionador que selecciones será el algoritmo utilizado para encontrar la solución',
      },
      step4: {
        title: 'Limitar tiempo',
        description: 'Selecciona el tiempo máximo para la ejecución',
        titleContent: 'Completa la siguiente información',
        subtitleContent:
          'Selecciona cuánto tiempo quieres que dure la ejecución',
        timeLimitPlaceholder: 'Por favor, inserta',
        time: 'Tiempo',
        secondsSuffix: 'seg',
      },
      step5: {
        title: 'Nombre y descripción',
        description: 'Nombra y describe la ejecución',
        titleContent: 'Completa la siguiente información',
        subtitleContent:
          'Por favor, proporciona un nombre y una breve descripción para la ejecución que se va a crear. Esto ayudará a buscarla e identificarla. Te recomendamos que sean breves y lo más concisos posible',
        nameTitleField: 'Nombre',
        descriptionTitleField: 'Descripción',
        namePlaceholder: 'Por favor, inserta un nombre',
        descriptionPlaceholder: 'Por favor, inserta una descripción',
      },
      step6: {
        title: 'Confirmar',
        description: 'Confirma los datos de la ejecución e inicia la ejecución',
        titleContent: 'Confirmación de la resolución de la ejecución',
        subtitleContent:
          'Si eliges resolver la ejecución, el modelo se iniciará automáticamente y tardará el tiempo estimado en finalizar. Puedes acceder a su estado abriendo la pestaña con el nombre asignado en la barra horizontal inferior.',
        resolve: 'Resolver',
        review: 'Revisar',
        successMessage:
          'La ejecución se ha lanzado con éxito. Se ha abierto una nueva pestaña en la barra inferior. Puedes hacer clic en esta pestaña para abrirla.',
        errorMessage:
          'Ha ocurrido un error al crear la ejecución. Por favor inténtelo de nuevo.',
        loadNewExecution: 'Cargar nueva ejecución',
      },
    },
    infoCard: {
      createNewExecution: 'Crear nueva ejecución',
      loadFromHistory: 'Cargar desde el historial',
      executionCreated: 'Ejecución creada con éxito',
      noExecutionSelected: 'No se ha seleccionado ninguna ejecución',
      solutionWillLoadMessage:
        'La solución se cargará automáticamente en esta vista cuando se haya terminado la resolución',
      loadExecutionMessage:
        'Puedes cargar una ejecución desde la vista del historial o crear una nueva y seleccionarla en la barra de pestañas inferior',
      noSolutionMessage:
        'La ejecución se ha creado correctamente, pero no se ha encontrado ninguna solución',
    },
  },
  executionTable: {
    date: 'Fecha',
    name: 'Nombre',
    description: 'Descripción',
    status: 'Estado',
    solver: 'Solucionador',
    solution: 'Solución',
    excel: 'Excel',
    actions: 'Acciones',
  },
  logIn: {
    subtitle: '¡Inicia sesión para empezar!',
    username_textfield_label: 'Nombre de usuario',
    password_textfield_label: 'Contraseña',
    button_label: 'Iniciar sesión',
    question: '¿Nuevo en Cornflow?',
    alternative: 'Registrarse',
    snackbar_message_success: 'Inicio de sesión exitoso',
    snackbar_message_error: 'Credenciales incorrectas',
  },
  signUp: {
    subtitle: 'Ingresa tus datos para registrarte',
    username_textfield_label: 'Nombre de usuario',
    email_textfield_label: 'Correo electrónico',
    password_textfield_label: 'Contraseña',
    password_confirmation_textfield_label: 'Confirma tu contraseña',
    button_label: 'Registrarse',
    question: '¿Ya eres miembro?',
    alternative: 'Iniciar sesión',
    snackbar_message_success: 'Registro exitoso. Ahora puedes iniciar sesión.',
    snackbar_message_error: 'Algo salió mal, por favor inténtalo de nuevo.',
  },
  rules: {
    required: 'Requerido',
    valid_email: 'Por favor, ingresa un correo electrónico válido.',
    password_length: 'La contraseña debe tener al menos {length} caracteres.',
    password_capital_letters:
      'La contraseña debe contener al menos 1 letra mayúscula',
    password_lower_case_letters:
      'La contraseña debe contener al menos 1 letra minúscula',
    password_numbers: 'La contraseña debe contener al menos 1 número',
    password_special_characters:
      "La contraseña debe contener al menos 1 carácter especial (!?@#$%^&*)(+=.<>{}[],/¿¡:;'|~`_-)",
    password_no_space: 'La contraseña no puede contener espacios',
    password_match: 'Las contraseñas no coinciden',
  },
  versionHistory: {
    title: 'Historial de versiones',
    description:
      'Aquí puedes encontrar un resumen de todas las versiones que has realizado para los diferentes proyectos ejecutados',
    yesterday: 'Ayer',
    today: 'Hoy',
    last7days: 'Últimos 7 días',
    lastMonth: 'Últimos 30 días',
    custom: 'Rango personalizado',
    from: 'Desde',
    to: 'Hasta',
    noData: 'No se encontraron datos para el rango de fechas seleccionado',
  },
  inputOutputData: {
    inputTitle: 'Datos de entrada',
    outputTitle: 'Datos de salida',
    save: 'Guardar',
    exitWithoutSaving: 'Salir sin guardar',
    saveChanges: 'Guardar cambios',
    savingMessage: '¿Estás seguro de que quieres guardar los cambios?',
    addItem: 'Agregar nuevo elemento',
    viewDetails: 'Ver detalles',
    hideDetails: 'Ocultar detalles',
    dataChecksInstanceMessage:
      'Se han detectado inconsistencias en la verificación de datos, lo que puede dar lugar a soluciones incorrectas o, en algunos casos, a la imposibilidad de encontrar una solución.',
    dataChecksSolutionMessage:
      'Se han detectado inconsistencias en la verificación de datos para la solución.',
    parameter: 'Parámetro',
    value: 'Valor',
    key: 'Clave',
  },
  settings: {
    currentPassword: 'Contraseña actual',
    newPassword: 'Nueva contraseña',
    confirmPassword: 'Confirmar contraseña',
    userSettings: 'Configuración de usuario',
    changePassword: 'Cambiar contraseña',
    submit: 'Enviar',
    language: 'Idioma',
    english: 'Inglés',
    spanish: 'Español',
    french: 'Francés',
    selectLanguage: 'Selecciona el idioma principal de la aplicación',
    theme: 'Tema',
    light: 'Claro',
    dark: 'Oscuro',
    selectTheme: 'Selecciona el tema principal de la aplicación',
    settings: 'Configuración',
    snackbarMessageSuccess: 'Contraseña actualizada correctamente',
    snackbarMessageError: 'Se produjo un error al actualizar la contraseña',
    required: 'Campo requerido',
    passwordRuleLength: 'Mín. {length} caracteres.',
    passwordRuleCharacters:
      'Debe contener mayúsculas, minúsculas, números y caracteres especiales',
    passWordRuleNoSpace: 'Una contraseña no puede contener espacios',
    passwordRuleNotMatch: 'Las contraseñas no coinciden',
  },
}
