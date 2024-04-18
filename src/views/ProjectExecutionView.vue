<template>
  <div class="view-container">
    <TitleView
      :icon="'mdi-chart-timeline-variant'"
      :title="title"
      :description="description"
    />
    <FormSteps
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
          <LoadInstanceStepTwo
            :fileSelected="instanceFile"
            @fileSelected="handleInstanceFileSelected"
            @instanceSelected="handleInstanceSelected"
            class="mt-4"
          >
          </LoadInstanceStepTwo>
        </template>

        <!-- Template for create execution step 3 -->
        <template v-else-if="index === 2">
          <CheckboxOptions
            :options="solvers"
            :multiple="false"
            @update:options="solvers = $event"
            class="mt-4"
          />
        </template>

        <!-- Template for create execution step 4 -->
        <template v-else-if="index === 3">
          <div style="width: 40%">
            <InputField
              class="mt-4"
              v-model="newExecution.timeLimit"
              :title="$t('projectExecution.steps.step4.time')"
              :placeholder="
                $t('projectExecution.steps.step4.timeLimitPlaceholder')
              "
              type="number"
              :suffix="$t('projectExecution.steps.step4.secondsSuffix')"
              prependInnerIcon="mdi-clock-time-four-outline"
            >
            </InputField>
          </div>
        </template>

        <template v-else-if="index === 4">
          <div class="input-fields-container">
            <div class="input-field">
              <InputField
                v-model="newExecution.name"
                :title="$t('projectExecution.steps.step5.nameTitleField')"
                :placeholder="
                  $t('projectExecution.steps.step5.namePlaceholder')
                "
                type="text"
              />
            </div>
            <div class="input-field">
              <InputField
                v-model="newExecution.description"
                :title="
                  $t('projectExecution.steps.step5.descriptionTitleField')
                "
                :placeholder="
                  $t('projectExecution.steps.step5.descriptionPlaceholder')
                "
                type="text"
                prependInnerIcon="mdi-text"
              />
            </div>
          </div>
        </template>

        <!-- Template for create execution step 6 -->
        <template v-else-if="index === 5">
          <div
            class="mt-4 d-flex justify-center"
            v-if="!executionLaunched && !executionIsLoading"
          >
            <v-btn
              @click="createExecution(true)"
              variant="outlined"
              prepend-icon="mdi-play"
            >
              {{ $t('projectExecution.steps.step6.resolve') }}
            </v-btn>
          </div>
          <div
            v-else-if="executionIsLoading"
            class="d-flex justify-center mt-5"
          >
            <v-progress-circular indeterminate></v-progress-circular>
          </div>
          <div v-else class="d-flex flex-column align-center justify-center">
            <v-icon style="font-size: 3.5rem" color="green" class="mt-5"
              >mdi-check-circle-outline</v-icon
            >
            <p class="text-center mt-3" style="font-size: 0.9rem">
              {{ $t('projectExecution.steps.step6.successMessage') }}
            </p>
            <v-btn
              @click="resetAndLoadNewExecution()"
              variant="outlined"
              class="mt-10"
            >
              {{ $t('projectExecution.steps.step6.loadNewExecution') }}
            </v-btn>
          </div>
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
    </FormSteps>
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
import TitleView from '@/components/core/TitleView.vue'
import FormSteps from '@/components/core/FormSteps.vue'
import CreateExecutionStepOne from '@/components/project-execution/CreateExecutionStepOne.vue'
import DateRangePicker from '@/components/core/DateRangePicker.vue'
import ProjectExecutionsTable from '@/components/project-execution/ProjectExecutionsTable.vue'
import LoadInstanceStepTwo from '@/components/project-execution/LoadInstanceStepTwo.vue'
import CheckboxOptions from '@/components/core/CheckboxOptions.vue'
import InputField from '@/components/core/InputField.vue'
import { useGeneralStore } from '@/stores/general'
import { inject } from 'vue'

export default {
  components: {
    TitleView,
    FormSteps,
    DateRangePicker,
    ProjectExecutionsTable,
    CreateExecutionStepOne,
    LoadInstanceStepTwo,
    CheckboxOptions,
    InputField,
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
      executionIsLoading: false,
      executionLaunched: false,
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
    async createExecution(createSolution = true) {
      try {
        this.executionIsLoading = true
        const result = await this.generalStore.createExecution(
          this.newExecution,
          createSolution,
        )
        if (result) {
          const loadedResult = await this.generalStore.fetchLoadedExecution(
            result.id,
          )

          if (loadedResult) {
            this.executionIsLoading = false
            this.executionLaunched = true
            this.showSnackbar(
              this.$t('projectExecution.snackbar.successCreate'),
            )
          } else {
            this.showSnackbar(
              this.$t('projectExecution.snackbar.errorCreate'),
              'error',
            )
          }
        } else {
          this.showSnackbar(
            this.$t('projectExecution.snackbar.error'),
            'errorCreate',
          )
        }
      } catch (error) {
        this.showSnackbar(
          this.$t('projectExecution.snackbar.error'),
          'errorCreate',
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
          !this.newExecution.instance) ||
        (this.currentStep === 2 &&
          this.optionSelected === 'createExecution' &&
          !this.newExecution.selectedSolver) ||
        (this.currentStep === 3 &&
          this.optionSelected === 'createExecution' &&
          !this.newExecution.timeLimit) ||
        (this.currentStep === 4 &&
          this.optionSelected === 'createExecution' &&
          !this.newExecution.name)
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
        ]
      }
    },
  },
}
</script>
<style scoped>
.input-fields-container {
  display: flex;
  justify-content: space-between;
}

.input-field {
  width: 45%;
}
</style>
