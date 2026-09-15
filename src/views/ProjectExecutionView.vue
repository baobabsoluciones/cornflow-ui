<template>
  <div class="view-container">
    <MTitleView
      :icon="'mdi-chart-timeline-variant'"
      :title="title"
      :description="description"
    />
    <MFormSteps
      :key="'form-steps-' + currentStep + '-' + formStepsKey"
      :steps="steps"
      :disablePreviousButton="disablePrevButton"
      :disableNextButton="disableNextButton"
      :currentStep="currentStep"
      :steps-column-width="'20%'"
      :continueButtonText="$t('projectExecution.continueButton')"
      :previousButtonText="$t('projectExecution.previousButton')"
      @update:currentStep="handleStepChange"
      class="mt-5"
    >
      <template v-for="(step, index) in steps" v-slot:[`step-${index}-content`]>
        <!-- Template for step 1 -->
        <template v-if="step.key === 'nameDescription'">
          <CreateExecutionNameDescription
            :name="newExecution.name"
            :description="newExecution.description"
            @update:name="newExecution.name = $event"
            @update:description="newExecution.description = $event"
          />
        </template>

        <!-- Template for step 2 -->
        <template v-else-if="step.key === 'loadInstance'">
          <CreateExecutionLoadInstance
            :key="componentKey"
            :selectedFiles="selectedFiles"
            :newExecution="newExecution"
            :existingInstanceErrors="existingInstanceErrors"
            @filesSelected="handleFilesSelected"
            @instanceSelected="handleInstanceSelected"
            @externalEtlData="handleExternalEtlData"
            @update:existingInstanceErrors="existingInstanceErrors = $event"
            class="mt-4"
          >
          </CreateExecutionLoadInstance>
        </template>

        <!-- Template for step 3 -->
        <template v-else-if="step.key === 'reviewInstance'">
          <CreateExecutionReviewInstance
            ref="reviewInstanceRef"
            :newExecution="newExecution"
            :instanceErrors="existingInstanceErrors"
            :isEditMode="isEditMode"
            :externalEtlFlow="externalEtlFlow.isActive ? externalEtlFlow.state : null"
            :is-step-active="currentStep === reviewInstanceStepIndex"
            @update:instance="handleInstanceSelected"
            @update:instanceErrors="existingInstanceErrors = $event"
            @has-pending-changes="hasPendingTableChanges = $event"
          />
        </template>

        <!-- Template for step 4 -->
        <template v-else-if="step.key === 'checkData'">
          <CreateExecutionCheckData
            :newExecution="newExecution"
            @update:instance="handleInstanceSelected"
            @checks-launching="checksLaunching = $event"
            @blocking-errors="checksHasBlockingErrors = $event"
          />
        </template>

        <!-- Template for step 5 -->
        <template v-else-if="step.key === 'selectSolver'">
          <MCheckboxOptions
            :options="solvers"
            :multiple="false"
            @update:options="solvers = $event"
            class="mt-4"
          />
        </template>

        <!-- Template for step 6 -->
        <template v-else-if="step.key === 'configParams'">
          <CreateExecutionConfigParams v-model="newExecution" class="mt-4" />
        </template>

        <!-- Template for step 7 -->
        <template v-else-if="step.key === 'solve'">
          <CreateExecutionSolve
            :newExecution="newExecution"
            @resetAndLoadNewExecution="resetAndLoadNewExecution"
            @executionLaunched="executionAlreadyLaunched = true"
          ></CreateExecutionSolve>
        </template>
      </template>
    </MFormSteps>
  </div>

  <!-- Exit confirmation modal -->
  <MBaseModal
    v-model="showExitConfirmationModal"
    :closeOnOutsideClick="false"
    :title="$t('projectExecution.exitConfirmation.title')"
    :buttons="[
      {
        text: $t('projectExecution.exitConfirmation.confirmButton'),
        action: 'confirm',
        class: 'primary-btn',
      },
      {
        text: $t('projectExecution.exitConfirmation.cancelButton'),
        action: 'cancel',
        class: 'secondary-btn',
      },
    ]"
    @confirm="handleConfirmExit"
    @cancel="handleCancelExit"
    @close="handleCancelExit"
  >
    <template #content>
      <v-row class="d-flex justify-center pr-2 pl-2 pb-5 pt-3">
        <span style="white-space: pre-line">{{
          $t('projectExecution.exitConfirmation.message')
        }}</span>
      </v-row>
    </template>
  </MBaseModal>

  <!-- Unsaved changes warning modal (for step changes) -->
  <UnsavedChangesWarningModal
    v-model="showUnsavedChangesModal"
    :changes-count="tableChanges.totalChangesCount"
    @stay="handleStayOnStep"
    @leave="handleLeaveStep"
  />
</template>

<script>
import CreateExecutionNameDescription from '@cornflow-ui/core/components/project-execution/CreateExecutionNameDescription.vue'
import CreateExecutionLoadInstance from '@cornflow-ui/core/components/project-execution/CreateExecutionLoadInstance.vue'
import CreateExecutionReviewInstance from '@cornflow-ui/core/components/project-execution/CreateExecutionReviewInstance.vue'
import CreateExecutionCheckData from '@cornflow-ui/core/components/project-execution/CreateExecutionCheckData.vue'
import CreateExecutionSolve from '@cornflow-ui/core/components/project-execution/CreateExecutionSolve.vue'
import CreateExecutionConfigParams from '@cornflow-ui/core/components/project-execution/CreateExecutionConfigParams.vue'
import UnsavedChangesWarningModal from '@cornflow-ui/core/components/core/UnsavedChangesWarningModal.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import { inject } from 'vue'
import { useRoute } from 'vue-router'
import { useTableChanges } from '@cornflow-ui/core/composables/useTableChanges'
import { useEtlFlowController } from '@cornflow-ui/core/composables/project-execution/useEtlFlowController'

export default {
  components: {
    CreateExecutionNameDescription,
    CreateExecutionSolve,
    CreateExecutionLoadInstance,
    CreateExecutionReviewInstance,
    CreateExecutionCheckData,
    CreateExecutionConfigParams,
    UnsavedChangesWarningModal,
  },
  data() {
    return {
      currentStep: 0,
      generalStore: useGeneralStore(),
      showSnackbar: null,
      selectedFiles: [],
      newExecution: {
        instance: null,
        config: {},
        name: null,
        description: null,
      },
      existingInstanceErrors: null,
      checksLaunching: false,
      checksHasBlockingErrors: false,
      isEditMode: false,
      showExitConfirmationModal: false,
      executionAlreadyLaunched: false,
      pendingNavigation: null,
      pendingNavigationTo: null,
      componentKey: 0,
      // Pending changes state
      hasPendingTableChanges: false,
      showUnsavedChangesModal: false,
      pendingStepChange: null,
      formStepsKey: 0,
      tableChanges: useTableChanges(),
      externalEtlFlow: useEtlFlowController(),
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
    const route = useRoute()

    this.isEditMode = route.query.editInstance === 'true'

    this.initializeEditMode()
    this.initializeDefaultSolver()
    this.initializeConfigFieldValues()
    this.initializeStep()
  },
  beforeRouteLeave(to, from, next) {
    // If the last step (solve) was already executed, allow leaving without confirmation
    if (this.executionAlreadyLaunched) {
      next()
      return
    }

    // Check if there's any progress to lose (including pending table changes)
    const hasProgress = this.hasProgressToLose() || this.hasPendingTableChanges

    if (!hasProgress) {
      // No progress to lose, allow navigation
      next()
      return
    }

    // Store the pending navigation and destination
    this.pendingNavigation = next
    this.pendingNavigationTo = to

    // Show confirmation modal
    this.showExitConfirmationModal = true

    // Don't call next() here - wait for user confirmation
  },
  methods: {
    // Initialize from selected execution when in edit mode
    initializeEditMode() {
      if (!this.isEditMode || !this.generalStore.selectedExecution) return

      const selectedExecution = this.generalStore.selectedExecution
      const instance =
        selectedExecution.experiment?.instance || selectedExecution.instance

      if (!instance) return

      this.newExecution.instance = instance
      if (selectedExecution.name)
        this.newExecution.name = selectedExecution.name
      if (selectedExecution.description)
        this.newExecution.description = selectedExecution.description
      if (selectedExecution.config)
        this.newExecution.config = { ...selectedExecution.config }
    },

    // Set default solver if solver step is hidden
    initializeDefaultSolver() {
      const solverConfig = this.generalStore.appConfig.parameters.solverConfig
      if (!solverConfig?.showSolverStep) {
        this.newExecution.config.solver = solverConfig.defaultSolver
      }
    },

    // Load config field values if config fields step is hidden
    initializeConfigFieldValues() {
      const configFieldsConfig =
        this.generalStore.appConfig.parameters.configFieldsConfig
      const shouldAutoLoad =
        !configFieldsConfig?.showConfigFieldsStep &&
        configFieldsConfig?.autoLoadValues &&
        this.newExecution.instance

      if (shouldAutoLoad) {
        this.loadConfigFieldValues()
      }
    },

    // Set initial step based on edit mode
    initializeStep() {
      this.$nextTick(() => {
        if (!this.isEditMode) return

        const steps = this.getExecutionSteps()
        const reviewIndex = steps.findIndex(
          (step) => step.key === 'reviewInstance',
        )
        this.currentStep = Math.max(reviewIndex, 0)
      })
    },

    async handleStepChange(newStep) {
      // Check if we're leaving the reviewInstance step with pending changes
      // Use tableChanges.hasChanges (singleton) so we don't depend on child event timing
      const currentStepKey = this.steps[this.currentStep]?.key
      const hasPending =
        this.tableChanges.hasChanges || this.hasPendingTableChanges
      if (currentStepKey === 'reviewInstance' && hasPending) {
        // Store the pending step change and show warning modal; do NOT update currentStep
        this.pendingStepChange = newStep
        this.showUnsavedChangesModal = true
        this.formStepsKey += 1 // Force MFormSteps to re-render with current step (stay on reviewInstance)
        return // Don't proceed with step change yet - step stays at currentStep
      }

      // Proceed with step change
      await this.proceedWithStepChange(newStep)
    },

    // Submit the external ETL update when leaving reviewInstance going forward.
    // Returns true if the step change should be aborted (submit failed).
    async submitExternalEtlUpdate() {
      try {
        const instanceData = this.newExecution.instance?.data
        if (instanceData) {
          const { data: finalData, warning } =
            await this.externalEtlFlow.submitUpdate(instanceData)
          const { Instance } = this.generalStore.appConfig
          const schemas = this.generalStore.getSchemaConfig
          const updatedInstance = new Instance(
            null,
            finalData,
            schemas.instanceSchema,
            schemas.instanceChecksSchema,
            this.generalStore.getSchemaName,
          )
          this.newExecution.instance = updatedInstance
          this.externalEtlFlow.reset()
          if (warning && this.showSnackbar) {
            this.showSnackbar(warning, 'warning', { persistent: true })
          }
        }
        return false
      } catch (error) {
        console.error('ETL update failed:', error)
        if (this.showSnackbar) {
          this.showSnackbar(error.message || 'ETL update failed', 'error')
        }
        // Force MFormSteps to re-render at the current step so the UI doesn't visually advance
        this.formStepsKey += 1
        return true
      }
    },

    // Whether config field values must be auto-loaded before moving to the given step
    shouldAutoLoadConfigFieldValues(nextStepKey) {
      const configFieldsConfig =
        this.generalStore.appConfig.parameters.configFieldsConfig
      const stepNeedsValues =
        nextStepKey === 'checkData' ||
        nextStepKey === 'configParams' ||
        nextStepKey === 'solve'
      return (
        !configFieldsConfig?.showConfigFieldsStep &&
        configFieldsConfig?.autoLoadValues &&
        stepNeedsValues
      )
    },

    async proceedWithStepChange(newStep) {
      const currentStepKey = this.steps[this.currentStep]?.key
      // (no shell instance needed: with ETL the user must always load via a button)

      // If leaving reviewInstance with external ETL flow active, submit the update first
      const leavingReviewWithEtl =
        currentStepKey === 'reviewInstance' &&
        this.externalEtlFlow.isActive &&
        newStep > this.currentStep
      if (leavingReviewWithEtl) {
        const aborted = await this.submitExternalEtlUpdate()
        if (aborted) return
      }

      if (
        !this.generalStore.appConfig.parameters.solverConfig?.showSolverStep
      ) {
        this.newExecution.config.solver =
          this.generalStore.appConfig.parameters.solverConfig.defaultSolver
      }
      // If we're skipping the config fields step, ensure values are loaded before steps that need them
      const nextStepKey = this.steps[newStep]?.key
      if (this.shouldAutoLoadConfigFieldValues(nextStepKey)) {
        await this.loadConfigFieldValues()
      }
      this.currentStep = newStep
    },

    // Handle staying on the current step (user chose to stay)
    handleStayOnStep() {
      this.pendingStepChange = null
      this.showUnsavedChangesModal = false
    },

    // Handle leaving the step (user chose to discard changes)
    handleLeaveStep() {
      // Clear pending changes
      this.tableChanges.clearAllChanges()
      this.hasPendingTableChanges = false

      // Proceed with the pending step change
      if (this.pendingStepChange !== null) {
        this.proceedWithStepChange(this.pendingStepChange)
        this.pendingStepChange = null
      }
      this.showUnsavedChangesModal = false
    },
    async validateInstanceSchema() {
      if (!this.newExecution.instance) {
        return
      }

      try {
        const validationErrors = await this.newExecution.instance.checkSchema()

        if (validationErrors && validationErrors.length > 0) {
          // Import formatValidationErrorsWithTitle dynamically to avoid circular dependencies
          const { formatValidationErrorsWithTitle } = await import(
            '@cornflow-ui/core/utils/errorFormatting'
          )

          // Format validation errors with full Ajv error details and translations
          const errorMessage = formatValidationErrorsWithTitle(
            this.$t(
              'projectExecution.steps.step3.loadInstance.instanceSchemaError',
            ),
            validationErrors, // Pass full Ajv ErrorObject array
            this.$t, // Pass translation function
          )

          this.existingInstanceErrors = errorMessage

          // Show snackbar notification (persistent - won't auto-close)
          if (this.showSnackbar) {
            this.showSnackbar(
              this.$t(
                'projectExecution.steps.step3.loadInstance.instanceSchemaError',
              ),
              'error',
              { persistent: true }, // Make it persistent so it doesn't auto-close
            )
          }
        } else {
          // Validation passed - clear errors
          this.existingInstanceErrors = null
        }
      } catch (error) {
        // Handle validation exception
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        this.existingInstanceErrors = errorMessage

        if (this.showSnackbar) {
          this.showSnackbar(
            this.$t(
              'projectExecution.steps.step3.loadInstance.unexpectedError',
            ),
            'error',
          )
        }
      }
    },
    async loadConfigFieldValues() {
      const configFields =
        this.generalStore.appConfig.parameters.configFields || []
      const newConfig = { ...this.newExecution.config }

      for (const field of configFields) {
        const fieldValue = this.extractFieldValue(field)
        this.setConfigFieldValue(newConfig, field, fieldValue)
      }

      this.newExecution.config = newConfig
    },

    extractFieldValue(field) {
      if (!this.hasValidDataSource(field)) {
        return field.default
      }

      const sourceData = this.newExecution.instance.data[field.source]
      return this.getValueFromSource(field, sourceData)
    },

    hasValidDataSource(field) {
      return (
        field.source &&
        this.newExecution.instance?.data &&
        this.newExecution.instance.data[field.source]
      )
    },

    getValueFromSource(field, sourceData) {
      if (field.lookupType === 'arrayByValue') {
        return this.getArrayByValueLookup(field, sourceData)
      }

      if (Array.isArray(sourceData)) {
        return undefined
      }

      return sourceData[field.param]
    },

    getArrayByValueLookup(field, arr) {
      const found = arr.find(
        (item) => item && item[field.lookupParam] === field.param,
      )
      return found ? found[field.lookupValue] : undefined
    },

    setConfigFieldValue(newConfig, field, value) {
      if (value !== undefined) {
        newConfig[field.key] = this.convertValueByType(value, field.type)
      } else if (field.default !== undefined) {
        newConfig[field.key] = field.default
      }
    },

    convertValueByType(value, type) {
      if (type === 'float') {
        return Number.parseFloat(value)
      } else if (type === 'number') {
        return Number.parseInt(value)
      }
      return value
    },

    getExecutionSteps() {
      const baseSteps = this.getBaseCreateSteps()
      this.addOptionalSteps(baseSteps)
      this.addSolveStep(baseSteps)
      return baseSteps
    },

    getBaseCreateSteps() {
      const steps = []

      // In edit mode, skip loadInstance step
      if (!this.isEditMode) {
        steps.push(this.createStepConfig('loadInstance', 1, true))
      }

      // Review instance step (order depends on whether loadInstance is present)
      const reviewOrder = this.isEditMode ? 1 : 2
      steps.push(this.createStepConfig('reviewInstance', reviewOrder, true))

      // Check data step
      const checkOrder = this.isEditMode ? 2 : 3
      steps.push(this.createStepConfig('checkData', checkOrder, true))

      return steps
    },

    addOptionalSteps(baseSteps) {
      let nextOrder = 4

      if (this.shouldShowSolverStep()) {
        baseSteps.push(this.createStepConfig('selectSolver', nextOrder, true))
        nextOrder++
      }

      if (this.shouldShowConfigFieldsStep()) {
        baseSteps.push(this.createStepConfig('configParams', nextOrder, true))
        nextOrder++
      }
    },

    addSolveStep(baseSteps) {
      const nameDescriptionOrder = this.calculateNameDescriptionStepOrder()
      baseSteps.push(
        this.createStepConfig('nameDescription', nameDescriptionOrder, true),
      )
      const solveOrder = this.calculateSolveStepOrder()
      baseSteps.push(this.createStepConfig('solve', solveOrder, true))
    },

    createStepConfig(key, order, hasSubtitle = false) {
      const config = {
        key,
        order,
        title: this.$t(`projectExecution.steps.${key}.title`),
        subtitle: this.$t(`projectExecution.steps.${key}.description`),
        titleContent: this.$t(`projectExecution.steps.${key}.titleContent`),
      }

      if (hasSubtitle) {
        config.subtitleContent = this.$t(
          `projectExecution.steps.${key}.subtitleContent`,
        )
      }

      return config
    },

    shouldShowSolverStep() {
      return this.generalStore.appConfig.parameters.solverConfig?.showSolverStep
    },

    shouldShowConfigFieldsStep() {
      return this.generalStore.appConfig.parameters.configFieldsConfig
        ?.showConfigFieldsStep
    },

    calculateNameDescriptionStepOrder() {
      let order = 4
      if (this.shouldShowSolverStep()) order++
      if (this.shouldShowConfigFieldsStep()) order++
      return order
    },
    calculateSolveStepOrder() {
      let order = 5
      if (this.shouldShowSolverStep()) order++
      if (this.shouldShowConfigFieldsStep()) order++
      return order
    },


    handleExternalEtlData(rawData) {
      this.externalEtlFlow.initializeFromEtlResponse(rawData)
    },
    handleFilesSelected(files) {
      this.selectedFiles = [...files]
    },
    handleInstanceSelected: async function (instance) {
      this.newExecution.instance = instance
      // If config fields step is skipped, load config values now
      if (
        !this.generalStore.appConfig.parameters.configFieldsConfig
          ?.showConfigFieldsStep &&
        this.generalStore.appConfig.parameters.configFieldsConfig
          ?.autoLoadValues
      ) {
        await this.loadConfigFieldValues()
      }
    },
    resetAndLoadNewExecution() {
      this.externalEtlFlow.reset()
      Object.assign(this.$data, this.$options.data())
      this.generalStore = useGeneralStore()
    },

    // Check if there's any progress that would be lost
    hasProgressToLose() {
      return (
        this.newExecution.name ||
        this.newExecution.description ||
        this.newExecution.instance ||
        (this.newExecution.config &&
          Object.keys(this.newExecution.config).length > 0) ||
        this.selectedFiles.length > 0 ||
        this.currentStep > 0
      )
    },

    // Handle confirmation to exit
    handleConfirmExit() {
      // Close modal first
      this.showExitConfirmationModal = false

      // Store navigation info before reset
      const navigationTo = this.pendingNavigationTo
      const navigationNext = this.pendingNavigation

      // Clear pending navigation
      this.pendingNavigation = null
      this.pendingNavigationTo = null

      // Clear pending table changes
      this.tableChanges.clearAllChanges()
      this.hasPendingTableChanges = false

      // Reset all data
      this.resetAndLoadNewExecution()

      // Force remount of child components by incrementing key
      this.componentKey++

      // Reinitialize default values after reset
      this.initializeDefaultSolver()

      // Use $nextTick to ensure reset is complete, then navigate
      this.$nextTick(() => {
        if (navigationNext && navigationTo) {
          // Navigate to the intended destination
          navigationNext()
        }
      })
    },

    // Handle cancellation of exit
    handleCancelExit() {
      // Close modal
      this.showExitConfirmationModal = false

      // Cancel navigation
      if (this.pendingNavigation) {
        this.pendingNavigation(false)
        this.pendingNavigation = null
      }
    },
  },
  watch: {
    currentStep(newVal, oldVal) {
      // Ensure solver is set when transitioning between steps if showSolverStep is false
      if (
        !this.generalStore.appConfig.parameters.solverConfig?.showSolverStep
      ) {
        this.newExecution.config.solver =
          this.generalStore.appConfig.parameters.solverConfig.defaultSolver
      }
    },
  },
  computed: {
    title() {
      return this.$t('projectExecution.title')
    },
    description() {
      return this.$t('projectExecution.description')
    },
    disableNextButton() {
      const currentStepKey = this.steps[this.currentStep]?.key

      return (
        (currentStepKey === 'nameDescription' && !this.newExecution.name) ||
        (currentStepKey === 'loadInstance' && this.loadInstanceStepBlocked) ||
        (currentStepKey === 'reviewInstance' &&
          (!this.newExecution.instance || this.existingInstanceErrors)) ||
        (currentStepKey === 'checkData' && (this.checksLaunching || this.checksHasBlockingErrors)) ||
        (this.generalStore.appConfig.parameters.solverConfig?.showSolverStep &&
          currentStepKey === 'selectSolver' &&
          !this.newExecution.config.solver) ||
        (this.generalStore.appConfig.parameters.configFieldsConfig
          ?.showConfigFieldsStep &&
          currentStepKey === 'configParams' &&
          this.isConfigFieldsIncomplete)
      )
    },
    disablePrevButton() {
      return this.currentStep === 0
    },
    solvers: {
      get() {
        return this.generalStore.getExecutionSolvers.map((solver) => ({
          value: solver,
          text: solver,
          description: '',
          checked: this.newExecution.config.solver === solver,
        }))
      },
      set(newSolvers) {
        let updatedSolvers = newSolvers
        let selectedSolver = updatedSolvers.find(
          (solver) => solver.checked === true,
        )
        this.newExecution.config.solver = selectedSolver
          ? selectedSolver.value
          : null
      },
    },
    steps() {
      return this.getExecutionSteps()
    },
    reviewInstanceStepIndex() {
      return this.steps.findIndex((s) => s.key === 'reviewInstance')
    },
    loadInstanceStepBlocked() {
      const currentStepKey = this.steps[this.currentStep]?.key
      if (currentStepKey !== 'loadInstance') return false

      if (this.existingInstanceErrors) return true

      const etl = this.generalStore.appConfig.parameters.etl

      // When ETL is active (useEtlBackend, enableLoadFromDb or alternativeParameterFields),
      // the user must always load data via one of the available buttons before continuing.
      const isEtlMode =
        etl?.useEtlBackend ||
        etl?.enableLoadFromDb ||
        (etl?.alternativeParameterFields?.length ?? 0) > 0

      if (isEtlMode) {
        return !this.newExecution.instance
      }

      // Default: file upload required
      return !this.newExecution.instance
    },
    isConfigFieldsIncomplete() {
      const fields = this.generalStore.appConfig.parameters.configFields || []
      return fields.some((field) => {
        const value = this.newExecution.config[field.key]
        if (field.type === 'boolean') {
          return typeof value !== 'boolean'
        }
        if (field.type === 'select' || field.type === 'text') {
          return !value
        }
        return value === null || value === undefined || value === ''
      })
    },
  },
}
</script>

<style scoped>
/* The global `.view-container` rule in SectionView.css pins `overflow: hidden`
   for all views, which clips this wizard so the Previous/Continue button row at
   the bottom of the step can't be reached. This view scrolls as one page
   instead. Scoped so SectionView (which relies on its own inner scroll) is
   unaffected. */
.view-container {
  overflow-y: auto;
}
</style>
