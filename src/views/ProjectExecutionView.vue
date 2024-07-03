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
      :continueButtonText="$t('projectExecution.continueButton')"
      :previousButtonText="$t('projectExecution.previousButton')"
      @update:currentStep="handleStepChange"
      class="mt-5"
    >
      <template v-for="(step, index) in steps" v-slot:[`step-${index}-content`]>
        <!-- Template for step 1 -->
        <template v-if="index === 0">
          <CreateExecutionStepOne
            :optionSelected="optionSelected"
            @update:optionSelected="optionSelected = $event"
          ></CreateExecutionStepOne>
        </template>

        <!-- Template for search execution step 2 -->
        <template
          v-else-if="index === 1 && optionSelected === 'searchExecution'"
        >
          <div>
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
          v-else-if="index === 1 && optionSelected === 'createExecution'"
        >
          <CreateExecutionNameDescription
            v-if="index === 1 && optionSelected === 'createExecution'"
            :name="newExecution.name"
            :description="newExecution.description"
            @update:name="newExecution.name = $event"
            @update:description="newExecution.description = $event"
          />
        </template>

        <!-- Template for create execution step 3 -->
        <template v-else-if="index === 2">
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
        <template v-else-if="index === 3">
          <CreateExecutionCheckData
            :newExecution="newExecution"
            @update:instance="handleInstanceSelected"
          />
        </template>

        <!-- Template for create execution step 5 -->
        <template v-else-if="index === 4">
          <MCheckboxOptions
            :options="solvers"
            :multiple="false"
            @update:options="solvers = $event"
            class="mt-4"
          />
        </template>

        <!-- Template for create execution step 6 -->
        <template v-else-if="index === 5">
          <div style="width: 40%">
            <MInputField
              class="mt-4"
              v-model="newExecution.timeLimit"
              :title="$t('projectExecution.steps.step6.time')"
              :placeholder="
                $t('projectExecution.steps.step6.timeLimitPlaceholder')
              "
              type="number"
              :suffix="$t('projectExecution.steps.step6.secondsSuffix')"
              prependInnerIcon="mdi-clock-time-four-outline"
            >
            </MInputField>
          </div>
        </template>

        <!-- Template for create execution step 7 -->
        <template v-else-if="index === 6">
          <CreateExecutionResolve
            :newExecution="newExecution"
            @resetAndLoadNewExecution="resetAndLoadNewExecution"
          ></CreateExecutionResolve>
        </template>
      </template>

      <!-- Template for continue button for search execution action -->
      <template
        v-if="
          optionSelected === 'searchExecution' &&
          selectedDates.startDate &&
          selectedDates.endDate
        "
        v-slot:[`step-1-continue-button`]
      >
        <v-btn color="primary" class="mt-5" @click="searchByDates"
          >{{ $t('projectExecution.steps.step2Search.search') }}
          <v-icon right>mdi-arrow-right</v-icon>
        </v-btn>
      </template>
    </MFormSteps>
    <v-card
      class="ma-5 mt-10"
      elevation="5"
      rounded="lg"
      v-if="optionSelected === 'searchExecution' && searchExecution"
    >
      <ProjectExecutionsTable
        :executionsByDate="executionsByDate"
        @loadExecution="loadExecution"
        @deleteExecution="deleteExecution"
      ></ProjectExecutionsTable>
    </v-card>
  </div>
</template>

<script>
import CreateExecutionStepOne from '@/components/project-execution/CreateExecutionStepOne.vue'
import CreateExecutionNameDescription from '@/components/project-execution/CreateExecutionNameDescription.vue'
import CreateExecutionLoadInstance from '@/components/project-execution/CreateExecutionLoadInstance.vue'
import CreateExecutionCheckData from '@/components/project-execution/CreateExecutionCheckData.vue'
import CreateExecutionResolve from '@/components/project-execution/CreateExecutionResolve.vue'
import DateRangePicker from '@/components/core/DateRangePicker.vue'
import ProjectExecutionsTable from '@/components/project-execution/ProjectExecutionsTable.vue'
import { useGeneralStore } from '@/stores/general'
import { inject } from 'vue'

export default {
  components: {
    DateRangePicker,
    ProjectExecutionsTable,
    CreateExecutionStepOne,
    CreateExecutionNameDescription,
    CreateExecutionResolve,
    CreateExecutionLoadInstance,
    CreateExecutionCheckData,
  },
  data() {
    return {
      optionSelected: null,
      searchExecution: false,
      executionsByDate: [],
      selectedDates: {
        startDate: null,
        endDate: null,
      },
      currentStep: 0,
      generalStore: useGeneralStore(),
      showSnackbar: null,
      instanceFile: null,
      selectedSolver: [],
      newExecution: {
        instance: null,
        selectedSolver: null,
        timeLimit: null,
        name: null,
        description: null,
      },
      existingInstanceErrors: null,
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
  },
  methods: {
    handleStepChange(newStep) {
      this.currentStep = newStep
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
    handleInstanceSelected(instance) {
      this.newExecution.instance = instance
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
          this.searchExecution = true
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
      this.showSnackbar = inject('showSnackbar')
    },
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
      return (
        (this.currentStep === 1 &&
          this.optionSelected === 'createExecution' &&
          !this.newExecution.name) ||
        (this.currentStep === 2 &&
          this.optionSelected === 'createExecution' &&
          (!this.newExecution.instance || this.existingInstanceErrors)) ||
        (this.currentStep === 4 &&
          this.optionSelected === 'createExecution' &&
          !this.newExecution.selectedSolver) ||
        (this.currentStep === 5 &&
          this.optionSelected === 'createExecution' &&
          !this.newExecution.timeLimit)
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
          checked: false,
        }))
      },
      set(newSolvers) {
        let updatedSolvers = newSolvers
        let selectedSolver = updatedSolvers.find(
          (solver) => solver.checked === true,
        )
        this.newExecution.selectedSolver = selectedSolver
          ? selectedSolver.value
          : null
      },
    },
    steps() {
      if (this.optionSelected === null) {
        return [
          {
            title: this.$t('projectExecution.steps.step1.title'),
            subtitle: this.$t('projectExecution.steps.step1.description'),
            titleContent: this.$t('projectExecution.steps.step1.titleContent'),
          },
        ]
      } else if (this.optionSelected === 'searchExecution') {
        return [
          {
            title: this.$t('projectExecution.steps.step1.title'),
            subtitle: this.$t('projectExecution.steps.step1.description'),
            titleContent: this.$t('projectExecution.steps.step1.titleContent'),
          },
          {
            title: this.$t('projectExecution.steps.step2Search.title'),
            subtitle: this.$t('projectExecution.steps.step2Search.description'),
            titleContent: this.$t(
              'projectExecution.steps.step2Search.titleContent',
            ),
            subtitleContent: this.$t(
              'projectExecution.steps.step2Search.subtitleContent',
            ),
          },
        ]
      } else if (this.optionSelected === 'createExecution') {
        return [
          {
            title: this.$t('projectExecution.steps.step1.title'),
            subtitle: this.$t('projectExecution.steps.step1.description'),
            titleContent: this.$t('projectExecution.steps.step1.titleContent'),
          },
          {
            title: this.$t('projectExecution.steps.step2.title'),
            subtitle: this.$t('projectExecution.steps.step2.description'),
            titleContent: this.$t('projectExecution.steps.step2.titleContent'),
            subtitleContent: this.$t(
              'projectExecution.steps.step2.subtitleContent',
            ),
          },
          {
            title: this.$t('projectExecution.steps.step3.title'),
            subtitle: this.$t('projectExecution.steps.step3.description'),
            titleContent: this.$t('projectExecution.steps.step3.titleContent'),
            subtitleContent: this.$t(
              'projectExecution.steps.step3.subtitleContent',
            ),
          },
          {
            title: this.$t('projectExecution.steps.step4.title'),
            subtitle: this.$t('projectExecution.steps.step4.description'),
            titleContent: this.$t('projectExecution.steps.step4.titleContent'),
            subtitleContent: this.$t(
              'projectExecution.steps.step4.subtitleContent',
            ),
          },
          {
            title: this.$t('projectExecution.steps.step5.title'),
            subtitle: this.$t('projectExecution.steps.step5.description'),
            titleContent: this.$t('projectExecution.steps.step5.titleContent'),
            subtitleContent: this.$t(
              'projectExecution.steps.step5.subtitleContent',
            ),
          },
          {
            title: this.$t('projectExecution.steps.step6.title'),
            subtitle: this.$t('projectExecution.steps.step6.description'),
            titleContent: this.$t('projectExecution.steps.step6.titleContent'),
            subtitleContent: this.$t(
              'projectExecution.steps.step6.subtitleContent',
            ),
          },
          {
            title: this.$t('projectExecution.steps.step7.title'),
            subtitle: this.$t('projectExecution.steps.step7.description'),
            titleContent: this.$t('projectExecution.steps.step7.titleContent'),
            subtitleContent: this.$t(
              'projectExecution.steps.step7.subtitleContent',
            ),
          },
        ]
      }
    },
  },
}
</script>
