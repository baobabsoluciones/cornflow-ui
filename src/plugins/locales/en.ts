export default {
  projectExecution: {
    title: 'Project execution',
    description:
      'Create a new execution or load an existing one to visualize the solution you are looking for. To do so, follow the steps below:',
    continueButton: 'Continue',
    previousButton: 'Previous',
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
          "If you choose to resolve the execution, the model will automatically initiate resolution and will take the estimated time to finish. You can access its status by opening the tab with the assigned name on the bottom horizontal bar.<br><br>If you decide to review the data you've inputted, a tab will be created on the same bottom horizontal bar, and you'll have access to the input data to modify as necessary. From there, you can proceed to resolve the execution.",
        resolve: 'Resolve',
        review: 'Review',
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
  logIn: {
    subtitle: 'Log in to get started!',
    username_textfield_label: 'Username',
    password_textfield_label: 'Password',
    button_label: 'Log in',
    question: 'New to Cornflow?',
    alternative: 'Sign up',
    snackbar_message_success: 'Successfully logged in',
    snackbar_message_error: 'Incorrect credentials'
  },
  signUp: {
    subtitle: 'Enter your details to register',
    username_textfield_label: 'Username',
    email_textfield_label: 'Email',
    password_textfield_label: 'Password',
    password_confirmation_textfield_label: 'Confirm your password',
    button_label: 'Sign up',
    question: 'Already a memeber?',
    alternative: 'Log in',
    snackbar_message_success: 'Register success. You can log in now.',
    snackbar_message_error: 'Something went wrong, please try again.'
  },
  rules: {
    required: "Required",
    valid_email: "Please enter a valid email adress.",
    password_length: "Password must be at least {length} characters long.",
    password_capital_letters: "Password must contain at least 1 capital letter",
    password_lower_case_letters: "Password must contain at least 1 lower case letter",
    password_numbers: "Password must contain at least 1 number",
    password_special_characters: "Password must contain at least 1 special character (!?@#$%^&*)(+=.<>{}[\],/¿¡:;'|~`_-)",
    password_no_space: "The password can not contain any spaces",
    password_match: "Passwords do not match"
  }
}
