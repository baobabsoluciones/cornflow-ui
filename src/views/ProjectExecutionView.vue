<template>
  <div class="view-container">
    <MTitleView
      :icon="'mdi-chart-timeline-variant'"
      :title="title"
      :description="description"
    />
    <MFormSteps
      :steps="steps"
      :disablePreviousButton="disablePrevButton"
      :disableNextButton="disableNextButton"
      :currentStep.sync="currentStep"
      :steps-column-width="'20vw'"
      :continueButtonText="$t('projectExecution.continueButton')"
      :previousButtonText="$t('projectExecution.previousButton')"
      @update:currentStep="handleStepChange"
      class="mt-5"
    >
      <template v-for="(step, index) in steps" v-slot:[`step-${index}-content`]>
        <!-- Template for step 1 -->
        <template v-if="step.key === 'createOrSearch'">
          <CreateExecutionCreateOrSearch
            :optionSelected="optionSelected"
            @update:optionSelected="optionSelected = $event"
          ></CreateExecutionCreateOrSearch>
        </template>

        <!-- Template for search execution step 2 -->
        <template
          v-else-if="step.key === 'searchDateRange' && optionSelected === 'searchExecution'"
        >
          <div ref="dateRangePicker">
            <DateRangePicker
              :startDateTitle="
                $t('projectExecution.steps.step2Search.startDate')
              "
              :endDateTitle="$t('projectExecution.steps.step2Search.endDate')"
              @start-date-change="handleStartDateChange"
              @end-date-change="handleEndDateChange"
            ></DateRangePicker>
          </div>
        </template>

        <!-- Template for create execution step 2 -->
        <template
          v-else-if="step.key === 'nameDescription' && optionSelected === 'createExecution'"
        >
          <CreateExecutionNameDescription
            :name="newExecution.name"
            :description="newExecution.description"
            @update:name="newExecution.name = $event"
            @update:description="newExecution.description = $event"
          />
        </template>

        <!-- Template for create execution step 3 -->
        <template v-else-if="step.key === 'loadInstance'">
          <CreateExecutionLoadInstance
            :fileSelected="instanceFile"
            :newExecution="newExecution"
            :existingInstanceErrors="existingInstanceErrors"
            @fileSelected="handleInstanceFileSelected"
            @instanceSelected="handleInstanceSelected"
            @update:existingInstanceErrors="existingInstanceErrors = $event"
            class="mt-4"
          >
          </CreateExecutionLoadInstance>
        </template>

        <!-- Template for create execution step 4 -->
        <template v-else-if="step.key === 'checkData'">
          <CreateExecutionCheckData
            :newExecution="newExecution"
            @update:instance="handleInstanceSelected"
            @checks-launching="checksLaunching = $event"
          />
        </template>

        <!-- Template for create execution step 5 -->
        <template v-else-if="step.key === 'selectSolver'">
          <MCheckboxOptions
            :options="solvers"
            :multiple="false"
            @update:options="solvers = $event"
            class="mt-4"
          />
        </template>

        <!-- Template for create execution step 6 -->
        <template v-else-if="step.key === 'configParams'">
          <CreateExecutionConfigParams
            v-model="newExecution"
            class="mt-4"
          />
        </template>

        <!-- Template for create execution step 7 -->
        <template v-else-if="step.key === 'solve'">
          <CreateExecutionSolve
            :newExecution="newExecution"
            @resetAndLoadNewExecution="resetAndLoadNewExecution"
          ></CreateExecutionSolve>
        </template>
      </template>

      <!-- Template for continue button for search execution action -->
      <template
        v-if="
          optionSelected === 'searchExecution' &&
          selectedDates.startDate &&
          selectedDates.endDate
        "
        v-slot:[`step-${getStepIndexByKey('searchDateRange')}-continue-button`]
      >
        <v-btn color="primary" @click="searchByDates"
          >{{ $t('projectExecution.steps.step2Search.search') }}
          <v-icon right>mdi-arrow-right</v-icon>
        </v-btn>
      </template>
    </MFormSteps>
    <v-card
      class="mt-8"
      elevation="5"
      rounded="lg"
      ref="executionTable"
      v-if="optionSelected === 'searchExecution' && searchExecution"
    >
      <v-row class="mt-3 ml-4">
        <MFilterSearch @search="handleSearch" />
      </v-row>
      <v-row class="mb-3 mx-2">
        <ProjectExecutionsTable
          :executionsByDate="executionsByDateFiltered"
          @loadExecution="loadExecution"
          @deleteExecution="deleteExecution"
        ></ProjectExecutionsTable>
      </v-row>
    </v-card>
  </div>
</template>

<script>
import CreateExecutionCreateOrSearch from '@/components/project-execution/CreateExecutionCreateOrSearch.vue'
import CreateExecutionNameDescription from '@/components/project-execution/CreateExecutionNameDescription.vue'
import CreateExecutionLoadInstance from '@/components/project-execution/CreateExecutionLoadInstance.vue'
import CreateExecutionCheckData from '@/components/project-execution/CreateExecutionCheckData.vue'
import CreateExecutionSolve from '@/components/project-execution/CreateExecutionSolve.vue'
import CreateExecutionConfigParams from '@/components/project-execution/CreateExecutionConfigParams.vue'
import DateRangePicker from '@/components/core/DateRangePicker.vue'
import ProjectExecutionsTable from '@/components/project-execution/ProjectExecutionsTable.vue'
import { useGeneralStore } from '@/stores/general'
import { inject } from 'vue'

export default {
  components: {
    DateRangePicker,
    ProjectExecutionsTable,
    CreateExecutionCreateOrSearch,
    CreateExecutionNameDescription,
    CreateExecutionSolve,
    CreateExecutionLoadInstance,
    CreateExecutionCheckData,
    CreateExecutionConfigParams,
  },
  data() {
    return {
      optionSelected: null,
      searchExecution: false,
      executionsByDate: [],
      executionsByDateFiltered: [],
      selectedDates: {
        startDate: null,
        endDate: null,
      },
      currentStep: 0,
      generalStore: useGeneralStore(),
      showSnackbar: null,
      instanceFile: null,
      newExecution: {
        instance: null,
        config: {},
        name: null,
        description: null,
      },
      existingInstanceErrors: null,
      searchExecutionText: '',
      checksLaunching: false,
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
    // Set default solver if configured to not show solver step
    if (!this.generalStore.appConfig.parameters.solverConfig?.showSolverStep) {
      this.newExecution.config.solver = this.generalStore.appConfig.parameters.solverConfig.defaultSolver
    }
    // Load config field values if configured to not show config fields step
    if (!this.generalStore.appConfig.parameters.configFieldsConfig?.showConfigFieldsStep && 
        this.generalStore.appConfig.parameters.configFieldsConfig?.autoLoadValues) {
      this.loadConfigFieldValues()
    }
  },
  methods: {
    async handleStepChange(newStep) {
      // If we're skipping the solver step, ensure the solver is set
      if (!this.generalStore.appConfig.parameters.solverConfig?.showSolverStep) {
        this.newExecution.config.solver = this.generalStore.appConfig.parameters.solverConfig.defaultSolver
      }
      // If we're skipping the config fields step, ensure values are loaded before steps that need them
      const nextStepKey = this.steps[newStep]?.key;
      if (
        !this.generalStore.appConfig.parameters.configFieldsConfig?.showConfigFieldsStep &&
        this.generalStore.appConfig.parameters.configFieldsConfig?.autoLoadValues &&
        (
          nextStepKey === 'checkData' ||
          nextStepKey === 'configParams' ||
          nextStepKey === 'solve'
        )
      ) {
        await this.loadConfigFieldValues();
      }
      this.currentStep = newStep;
    },
    async loadConfigFieldValues() {
      const configFields = this.generalStore.appConfig.parameters.configFields || []
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
        (item) => item && item[field.lookupParam] === field.param
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
        return parseFloat(value)
      } else if (type === 'number') {
        return parseInt(value)
      }
      return value
    },

    getInitialSteps() {
      return [this.createStepConfig('createOrSearch', 1, 'step1')]
    },

    getSearchExecutionSteps() {
      return [
        this.createStepConfig('createOrSearch', 1, 'step1'),
        this.createStepConfig('searchDateRange', 2, 'step2Search', true)
      ]
    },

    getCreateExecutionSteps() {
      const baseSteps = this.getBaseCreateSteps()
      this.addOptionalSteps(baseSteps)
      this.addSolveStep(baseSteps)
      return baseSteps
    },

    getBaseCreateSteps() {
      return [
        this.createStepConfig('createOrSearch', 1, 'step1'),
        this.createStepConfig('nameDescription', 2, 'step2', true),
        this.createStepConfig('loadInstance', 3, 'step3', true),
        this.createStepConfig('checkData', 4, 'step4', true)
      ]
    },

    addOptionalSteps(baseSteps) {
      let nextOrder = 5

      if (this.shouldShowSolverStep()) {
        baseSteps.push(this.createStepConfig('selectSolver', nextOrder, 'step5', true))
        nextOrder++
      }

      if (this.shouldShowConfigFieldsStep()) {
        baseSteps.push(this.createStepConfig('configParams', nextOrder, 'step6', true))
        nextOrder++
      }
    },

    addSolveStep(baseSteps) {
      const solveOrder = this.calculateSolveStepOrder()
      baseSteps.push(this.createStepConfig('solve', solveOrder, 'step7', true))
    },

    createStepConfig(key, order, stepKey, hasSubtitle = false) {
      const config = {
        key,
        order,
        title: this.$t(`projectExecution.steps.${stepKey}.title`),
        subtitle: this.$t(`projectExecution.steps.${stepKey}.description`),
        titleContent: this.$t(`projectExecution.steps.${stepKey}.titleContent`)
      }

      if (hasSubtitle) {
        config.subtitleContent = this.$t(`projectExecution.steps.${stepKey}.subtitleContent`)
      }

      return config
    },

    shouldShowSolverStep() {
      return this.generalStore.appConfig.parameters.solverConfig?.showSolverStep
    },

    shouldShowConfigFieldsStep() {
      return this.generalStore.appConfig.parameters.configFieldsConfig?.showConfigFieldsStep
    },

    calculateSolveStepOrder() {
      let order = 5
      if (this.shouldShowSolverStep()) order++
      if (this.shouldShowConfigFieldsStep()) order++
      return order
    },

    handleCheckboxChange({ value, option }) {
      this.optionSelected = value ? option : null
    },
    handleStartDateChange(newDate) {
      this.selectedDates.startDate = newDate
    },
    handleEndDateChange(newDate) {
      this.selectedDates.endDate = newDate
    },
    handleInstanceFileSelected(file) {
      this.instanceFile = file
    },
    handleInstanceSelected: async function(instance) {
      this.newExecution.instance = instance;
      // If config fields step is skipped, load config values now
      if (
        !this.generalStore.appConfig.parameters.configFieldsConfig?.showConfigFieldsStep &&
        this.generalStore.appConfig.parameters.configFieldsConfig?.autoLoadValues
      ) {
        await this.loadConfigFieldValues();
      }
    },
    async searchByDates() {
      try {
        const result = await this.generalStore.fetchExecutionsByDateRange(
          this.selectedDates.startDate,
          this.selectedDates.endDate,
        )
        if (result) {
          this.showSnackbar(this.$t('projectExecution.snackbar.succesSearch'))
          this.executionsByDate = result
          this.executionsByDateFiltered = result
          this.handleSearch(this.searchExecutionText)
          this.searchExecution = true
          this.$nextTick(() => {
            const executionTable = this.$refs.executionTable
            if (executionTable && executionTable.$el) {
              executionTable.$el.scrollIntoView({ behavior: 'smooth' })
            }
          })
        } else {
          this.showSnackbar(this.$t('projectExecution.snackbar.noDataSearch'))
        }
      } catch (error) {
        this.showSnackbar(
          this.$t('projectExecution.snackbar.errorSearch'),
          'error',
        )
      }
    },
    async loadExecution(execution) {
      try {
        const loadedResult = await this.generalStore.fetchLoadedExecution(
          execution.id,
        )

        if (loadedResult) {
          this.showSnackbar(this.$t('projectExecution.snackbar.successLoad'))
        } else {
          this.showSnackbar(
            this.$t('projectExecution.snackbar.errorLoad'),
            'error',
          )
        }
      } catch (error) {
        this.showSnackbar(
          this.$t('projectExecution.snackbar.errorLoad'),
          'error',
        )
      }
    },
    async deleteExecution(execution) {
      try {
        const result = await this.generalStore.deleteExecution(execution.id)

        if (result) {
          this.executionsByDate = this.executionsByDate.filter(
            (exec) => exec.id !== execution.id,
          )
          this.showSnackbar(this.$t('projectExecution.snackbar.successDelete'))
        } else {
          this.showSnackbar(
            this.$t('projectExecution.snackbar.errorDelete'),
            'error',
          )
        }
      } catch (error) {
        this.showSnackbar(
          this.$t('projectExecution.snackbar.errorDelete'),
          'error',
        )
      }
    },
    resetAndLoadNewExecution() {
      Object.assign(this.$data, this.$options.data())
      // Reinitialize the store since we reset the data
      this.generalStore = useGeneralStore()
    },
    handleSearch(searchText) {
      this.searchExecutionText = searchText
      const searchTextLower = searchText.toLowerCase()
      if (searchTextLower === '') {
        this.executionsByDateFiltered = this.executionsByDate
        return
      }

      this.executionsByDateFiltered = this.executionsByDate.filter(
        (execution) =>
          execution.name.toLowerCase().includes(searchTextLower) ||
          execution.description.toLowerCase().includes(searchTextLower),
      )
    },
    getStepIndexByKey(key) {
      return this.steps.findIndex(step => step.key === key);
    }
  },
  watch: {
    currentStep(newVal, oldVal) {
      if (this.optionSelected === 'searchExecution') {
        this.executionsByDate = []
        this.selectedDates = {
          startDate: null,
          endDate: null,
        }
        this.searchExecution = false
        this.$nextTick(() => {
          const datePickerCards = this.$refs.dateRangePicker
          if (datePickerCards) {
            datePickerCards.scrollIntoView({ behavior: 'smooth' })
          }
        })
      }
      // Ensure solver is set when transitioning between steps if showSolverStep is false
      if (!this.generalStore.appConfig.parameters.solverConfig?.showSolverStep) {
        this.newExecution.config.solver = this.generalStore.appConfig.parameters.solverConfig.defaultSolver
      }
    },
    optionSelected(newVal) {
      // Reset solver when changing option if showSolverStep is false
      if (!this.generalStore.appConfig.parameters.solverConfig?.showSolverStep) {
        this.newExecution.config.solver = this.generalStore.appConfig.parameters.solverConfig.defaultSolver
      }
    }
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
        (currentStepKey === 'nameDescription' &&
          this.optionSelected === 'createExecution' &&
          !this.newExecution.name) ||
        (currentStepKey === 'loadInstance' &&
          this.optionSelected === 'createExecution' &&
          (!this.newExecution.instance || this.existingInstanceErrors)) ||
        (currentStepKey === 'checkData' &&
          this.optionSelected === 'createExecution' &&
          this.checksLaunching) ||
        (this.generalStore.appConfig.parameters.solverConfig?.showSolverStep &&
          currentStepKey === 'selectSolver' &&
          this.optionSelected === 'createExecution' &&
          !this.newExecution.config.solver) ||
        (this.generalStore.appConfig.parameters.configFieldsConfig?.showConfigFieldsStep &&
          currentStepKey === 'configParams' &&
          this.optionSelected === 'createExecution' &&
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
      if (this.optionSelected === null) {
        return this.getInitialSteps()
      } else if (this.optionSelected === 'searchExecution') {
        return this.getSearchExecutionSteps()
      } else if (this.optionSelected === 'createExecution') {
        return this.getCreateExecutionSteps()
      }
    },
    isConfigFieldsIncomplete() {
      const fields = this.generalStore.appConfig.parameters.configFields || []
      return fields.some(field => {
        const value = this.newExecution.config[field.key]
        if (field.type === 'boolean') {
          return typeof value !== 'boolean'
        }
        if (field.type === 'select' || field.type === 'text') {
          return !value
        }
        return value === null || value === undefined || value === ''
      })
    }
  },
}
</script>
