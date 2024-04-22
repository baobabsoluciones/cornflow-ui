export default {
  projectExecution: {
    title: 'Project execution',
    description:
      'Create a new execution or load an existing one to visualize the solution you are looking for. To do so, follow the steps below:',
    continueButton: 'Continue',
    previousButton: 'Previous',
    snackbar: {
      successCreate: 'Execution created successfully',
      errorCreate: 'An error occurred while creating the execution',
      succesSearch: 'Search succesfully completed',
      errorSearch: 'An error occurred while searching for executions',
      noDataSearch: 'No executions found in the selected interval',
      successDelete: 'Execution deleted successfully',
      errorDelete: 'An error occurred while deleting the execution',
      successLoad: 'Execution loaded successfully',
      errorLoad: 'An error occurred while loading the execution',
    },
    steps: {
      step1: {
        title: 'New execution',
        description: 'Create a new execution',
        titleContent: 'Choose one',
        firstOption: {
          title: 'Create a new execution',
          description:
            'A new execution will be created for which a new instance of the input data table with the correct structure will need to be uploaded.',
        },
        secondOption: {
          title: 'Search for and load an existing execution',
          description:
            'Search by date for an existing execution and load it to view.',
        },
      },
      step2Search: {
        title: 'Select dates',
        description: 'Select the dates for searching an execution',
        titleContent: 'Select the dates',
        subtitleContent:
          'Choose a start date and an end date to search for executions within the interval between them',
        startDate: 'Start date',
        endDate: 'End date',
        search: 'Search',
      },
      step2: {
        title: 'Load instance',
        description: 'Load a file with the instance data',
        titleContent: 'Load instance',
        subtitleContent: 'Select a file to load the instance data',
        loadInstance: {
          dragAndDropDescription: 'Drag and drop your instance file here',
          uploadFile: 'Upload file',
          noSchemaError:
            'No schema was found: are you connected to the server?',
          instanceSchemaError: 'Instance does not comply with schema ',
          instanceLoaded: 'Instance loaded successfully',
          invalidFileFormat: 'Invalid file format. Please try again.',
          unexpectedError: 'An unexpected error occurred. Please try again.',
        },
      },
      step3: {
        title: 'Select solver',
        description: 'Select the solver to use for the execution',
        titleContent: 'Select a solver',
        subtitleContent:
          'The solver you select will be the algorithm used to find the solution',
      },
      step4: {
        title: 'Limit time',
        description: 'Select the maximum time for the execution',
        titleContent: 'Fill the following information',
        subtitleContent: 'Select how long you want the execution run to last',
        timeLimitPlaceholder: 'Please insert',
        time: 'Time',
        secondsSuffix: 'sec',
      },
      step5: {
        title: 'Name and description',
        description: 'Name and describe the execution',
        titleContent: 'Fill the following information',
        subtitleContent:
          'Please provide a name and a brief description for the execution to be created. This will aid in searching and identifying it. We recommend keeping them brief and as concise as possible',
        nameTitleField: 'Name',
        descriptionTitleField: 'Description',
        namePlaceholder: 'Please insert a name',
        descriptionPlaceholder: 'Please insert a description',
      },
      step6: {
        title: 'Confirm',
        description: 'Confirm the execution data and start the execution',
        titleContent: 'Execution resolution confirmation',
        subtitleContent:
          'If you choose to resolve the execution, the model will automatically initiate resolution and will take the estimated time to finish. You can access its status by opening the tab with the assigned name on the bottom horizontal bar.',
        resolve: 'Resolve',
        review: 'Review',
        successMessage:
          'The execution has been launched successfully. A new tab has been opened on the bottom bar. You can click on this tab to open it.',
        loadNewExecution: 'Load new execution',
      },
    },
  },
  executionTable: {
    date: 'Date',
    name: 'Name',
    description: 'Description',
    status: 'Status',
    solver: 'Solver',
    solution: 'Solution',
    excel: 'Excel',
    actions: 'Actions',
  },
  versionHistory: {
    title: 'Version history',
    description:
      'Here you can find a summary of all the versions you have made for the different projects executed',
    yesterday: 'Yesterday',
    today: 'Today',
    last7days: 'Last 7 days',
    lastMonth: 'Last 30 days',
    custom: 'Custom range',
    from: 'From',
    to: 'To',
    noData: ' No data found for the selected range dates',
  },
}
