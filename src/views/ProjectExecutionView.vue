<template>
  <div class="view-container">
    <TitleView
      :icon="'mdi-chart-timeline-variant'"
      :title="title"
      :description="description"
    />
    <FormSteps :steps="steps" class="mt-5">
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
          <LoadInstanceStepTwo class="mt-4"> </LoadInstanceStepTwo>
        </template>

        <!-- Template for create execution step 3 -->
        <template v-else-if="index === 2"> </template>

        <!-- Template for create execution step 4 -->
        <template v-else-if="index === 3"> </template>

        <!-- Template for create execution step 5 -->
        <template v-else-if="index === 4"> </template>

        <!-- Template for create execution step 6 -->
        <template v-else-if="index === 5"> </template>
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
      class="ma-5"
      v-if="optionSelected === 'searchExecution' && searchExecution"
    >
      <ProjectExecutionsTable
        :executionsByDate="executionsByDate"
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
      generalStore: useGeneralStore(),
      showSnackbar: null,
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
  },
  methods: {
    handleCheckboxChange({ value, option }) {
      this.optionSelected = value ? option : null
    },
    handleStartDateChange(newDate) {
      this.selectedDates.startDate = newDate
    },
    handleEndDateChange(newDate) {
      this.selectedDates.endDate = newDate
    },
    async searchByDates() {
      try {
        const result = await this.generalStore.fetchExecutionsByDateRange(
          this.selectedDates.startDate,
          this.selectedDates.endDate,
        )
        if (result) {
          this.showSnackbar('Búsqueda realizada correctamente')
          this.executionsByDate = result
          this.searchExecution = true
        } else {
          this.showSnackbar('No hay datos para mostrar', 'error')
        }
      } catch (error) {
        this.showSnackbar('Error al realizar la búsqueda', 'error')
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
<style></style>
