export default {
  projectExecution: {
    title: 'Exécution du projet',
    description:
      'Créez une nouvelle exécution ou chargez une exécution existante pour visualiser la solution que vous recherchez. Pour ce faire, suivez les étapes ci-dessous :',
    continueButton: 'Continuer',
    previousButton: 'Précédent',
    snackbar: {
      successCreate: 'Exécution créée avec succès',
      errorCreate: "Une erreur est survenue lors de la création de l'exécution",
      succesSearch: 'Recherche terminée avec succès',
      errorSearch: "Une erreur est survenue lors de la recherche d'exécutions",
      noDataSearch: "Aucune exécution trouvée dans l'intervalle sélectionné",
      successDelete: 'Exécution supprimée avec succès',
      errorDelete:
        "Une erreur est survenue lors de la suppression de l'exécution",
      successLoad: 'Exécution chargée avec succès',
      errorLoad: "Une erreur est survenue lors du chargement de l'exécution",
    },
    steps: {
      step1: {
        title: 'Nouvelle exécution',
        description: 'Créer une nouvelle exécution',
        titleContent: 'Choisissez une option',
        firstOption: {
          title: 'Créer une nouvelle exécution',
          description:
            "Une nouvelle exécution sera créée pour laquelle une nouvelle instance du tableau de données d'entrée avec la structure correcte devra être téléchargée.",
        },
        secondOption: {
          title: 'Rechercher et charger une exécution existante',
          description:
            'Recherchez par date une exécution existante et chargez-la pour la visualiser.',
        },
      },
      step2Search: {
        title: 'Sélectionner les dates',
        description: 'Sélectionnez les dates pour rechercher une exécution',
        titleContent: 'Sélectionnez les dates',
        subtitleContent:
          "Choisissez une date de début et une date de fin pour rechercher des exécutions dans l'intervalle entre elles",
        startDate: 'Date de début',
        endDate: 'Date de fin',
        search: 'Rechercher',
      },
      step2: {
        title: "Charger l'instance",
        description: "Chargez un fichier avec les données de l'instance",
        titleContent: "Charger l'instance",
        subtitleContent:
          "Sélectionnez un fichier pour charger les données de l'instance",
        loadInstance: {
          dragAndDropDescription:
            "Faites glisser et déposez votre fichier d'instance ici",
          uploadFile: 'Télécharger le fichier',
          noSchemaError:
            "Aucun schéma n'a été trouvé : êtes-vous connecté au serveur ?",
          instanceSchemaError: "L'instance ne respecte pas le schéma",
          instanceLoaded: 'Instance chargée avec succès',
          invalidFileFormat:
            'Format de fichier non valide. Veuillez réessayer.',
          unexpectedError:
            "Une erreur inattendue s'est produite. Veuillez réessayer.",
        },
      },
      step3: {
        title: 'Sélectionner le solveur',
        description: "Sélectionnez le solveur à utiliser pour l'exécution",
        titleContent: 'Sélectionnez un solveur',
        subtitleContent:
          "Le solveur que vous sélectionnez sera l'algorithme utilisé pour trouver la solution",
      },
      step4: {
        title: 'Limiter le temps',
        description: "Sélectionnez le temps maximum pour l'exécution",
        titleContent: 'Remplissez les informations suivantes',
        subtitleContent: "Sélectionnez la durée souhaitée pour l'exécution",
        timeLimitPlaceholder: 'Veuillez insérer',
        time: 'Temps',
        secondsSuffix: 'sec',
      },
      step5: {
        title: 'Nom et description',
        description: "Nommez et décrivez l'exécution",
        titleContent: 'Remplissez les informations suivantes',
        subtitleContent:
          "Veuillez fournir un nom et une brève description pour l'exécution à créer. Cela aidera à la rechercher et à l'identifier. Nous vous recommandons d'être bref et aussi concis que possible",
        nameTitleField: 'Nom',
        descriptionTitleField: 'Description',
        namePlaceholder: 'Veuillez insérer un nom',
        descriptionPlaceholder: 'Veuillez insérer une description',
      },
      step6: {
        title: 'Confirmer',
        description: "Confirmez les données d'exécution et lancez l'exécution",
        titleContent: "Confirmation de la résolution de l'exécution",
        subtitleContent:
          "Si vous choisissez de résoudre l'exécution, le modèle démarrera automatiquement et prendra le temps estimé pour se terminer. Vous pouvez accéder à son état en ouvrant l'onglet avec le nom attribué dans la barre horizontale inférieure.",
        resolve: 'Résoudre',
        review: 'Revoir',
        successMessage:
          "L'exécution a été lancée avec succès. Un nouvel onglet a été ouvert dans la barre inférieure. Vous pouvez cliquer sur cet onglet pour l'ouvrir.",
        loadNewExecution: 'Charger une nouvelle exécution',
      },
    },
    infoCard: {
      createNewExecution: 'Créer une nouvelle exécution',
      loadFromHistory: "Charger depuis l'historique",
      executionCreated: 'Exécution créée avec succès',
      noExecutionSelected: 'Aucune exécution sélectionnée',
      solutionWillLoadMessage:
        'La solution sera chargée automatiquement dans cette vue lorsque la résolution sera terminée',
      loadExecutionMessage:
        "Vous pouvez charger une exécution depuis la vue de l'historique ou en créer une nouvelle et la sélectionner dans la barre d'onglets inférieure",
      noSolutionMessage:
        "L'exécution a été créée avec succès, mais aucune solution n'a été trouvée",
    },
  },
  executionTable: {
    date: 'Date',
    name: 'Nom',
    description: 'Description',
    status: 'Statut',
    solver: 'Solveur',
    solution: 'Solution',
    excel: 'Excel',
    actions: 'Actions',
  },
  logIn: {
    subtitle: 'Connectez-vous pour commencer !',
    username_textfield_label: "Nom d'utilisateur",
    password_textfield_label: 'Mot de passe',
    button_label: 'Se connecter',
    question: 'Nouveau sur Cornflow ?',
    alternative: "S'inscrire",
    snackbar_message_success: 'Connexion réussie',
    snackbar_message_error: 'Identifiants incorrects',
  },
  signUp: {
    subtitle: 'Entrez vos informations pour vous inscrire',
    username_textfield_label: "Nom d'utilisateur",
    email_textfield_label: 'Adresse e-mail',
    password_textfield_label: 'Mot de passe',
    password_confirmation_textfield_label: 'Confirmez votre mot de passe',
    button_label: "S'inscrire",
    question: 'Déjà membre ?',
    alternative: 'Se connecter',
    snackbar_message_success:
      'Inscription réussie. Vous pouvez maintenant vous connecter.',
    snackbar_message_error: "Une erreur s'est produite, veuillez réessayer.",
  },
  rules: {
    required: 'Obligatoire',
    valid_email: 'Veuillez entrer une adresse e-mail valide.',
    password_length:
      'Le mot de passe doit contenir au moins {length} caractères.',
    password_capital_letters:
      'Le mot de passe doit contenir au moins 1 lettre majuscule',
    password_lower_case_letters:
      'Le mot de passe doit contenir au moins 1 lettre minuscule',
    password_numbers: 'Le mot de passe doit contenir au moins 1 chiffre',
    password_special_characters:
      "Le mot de passe doit contenir au moins 1 caractère spécial (!?@#$%^&*)(+=.<>{}[],/¿¡:;'|~`_-)",
    password_no_space: "Le mot de passe ne peut pas contenir d'espaces",
    password_match: 'Les mots de passe ne correspondent pas',
  },
  versionHistory: {
    title: 'Historique des versions',
    description:
      'Vous pouvez ici trouver un résumé de toutes les versions que vous avez réalisées pour les différents projets exécutés',
    yesterday: 'Hier',
    today: "Aujourd'hui",
    last7days: '7 derniers jours',
    lastMonth: '30 derniers jours',
    custom: 'Plage personnalisée',
    from: 'De',
    to: 'À',
    noData: 'Aucune donnée trouvée pour la plage de dates sélectionnée',
  },
  inputOutputData: {
    inputTitle: "Données d'entrée",
    outputTitle: 'Données de sortie',
    save: 'Enregistrer',
    exitWithoutSaving: 'Quitter sans enregistrer',
    saveChanges: 'Enregistrer les modifications',
    savingMessage: 'Êtes-vous sûr de vouloir enregistrer les modifications ?',
    addItem: 'Ajouter un nouvel élément',
    viewDetails: 'Afficher les détails',
    hideDetails: 'Masquer les détails',
    dataChecksInstanceMessage:
      "Des incohérences dans la vérification des données ont été détectées, ce qui peut entraîner des solutions incorrectes ou, dans certains cas, l'impossibilité de trouver une solution.",
    dataChecksSolutionMessage:
      'Des incohérences dans la vérification des données ont été détectées pour la solution.',
    parameter: 'Paramètre',
    value: 'Valeur',
    key: 'Clé',
  },
  settings: {
    currentPassword: 'Mot de passe actuel',
    newPassword: 'Nouveau mot de passe',
    confirmPassword: 'Confirmer le mot de passe',
    userSettings: 'Paramètres utilisateur',
    changePassword: 'Changer le mot de passe',
    submit: 'Soumettre',
    language: 'Langue',
    english: 'Anglais',
    spanish: 'Espagnol',
    french: 'Français',
    selectLanguage: "Sélectionnez la langue principale de l'application",
    theme: 'Thème',
    light: 'Clair',
    dark: 'Sombre',
    selectTheme: "Sélectionnez le thème principal de l'application",
    settings: 'Paramètres',
    required: 'Champ requis',
    passwordRuleLength: 'Min. {length} caractères.',
    passwordRuleCharacters:
      'Doit contenir des majuscules, des minuscules, des chiffres et des caractères spéciaux',
    passWordRuleNoSpace: "Un mot de passe ne peut pas contenir d'espaces",
    passwordRuleNotMatch: 'Les mots de passe ne correspondent pas',
  },
}
