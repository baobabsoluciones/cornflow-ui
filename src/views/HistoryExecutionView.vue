<template>
  <div class="view-container">
    <TitleView
      :icon="'mdi-history'"
      :title="title"
      :description="description"
    />
    <PanelData
      class="mt-5"
      :data="data"
      :checkboxOptions="labels"
      :noDataMessage="$t('versionHistory.noData')"
      @date-range-changed="dateOptionSelected = $event"
    >
      <template #custom-checkbox>
        <v-row>
          <v-col cols="6">
            <v-text-field
              :label="$t('versionHistory.from')"
              type="date"
              v-model="customSelectedDates.startDate"
            ></v-text-field>
          </v-col>
          <v-col cols="6">
            <v-text-field
              :label="$t('versionHistory.to')"
              type="date"
              v-model="customSelectedDates.endDate"
            ></v-text-field>
          </v-col>
        </v-row>
      </template>
      <template v-slot:table="slotProps">
        <ProjectExecutionsTable
          :executionsByDate="slotProps.itemData"
          :showFooter="false"
          :showHeaders="slotProps.showHeaders"
          :formatDateByTime="true"
          @loadExecution="loadExecution"
          @deleteExecution="deleteExecution"
        ></ProjectExecutionsTable>
      </template>
    </PanelData>
  </div>
</template>

<script>
import PanelData from '@/components/core/PanelData.vue'
import ProjectExecutionsTable from '@/components/project-execution/ProjectExecutionsTable.vue'
import TitleView from '@/components/core/TitleView.vue'
import { useGeneralStore } from '@/stores/general'
import def from 'ajv/dist/vocabularies/discriminator'
import { inject } from 'vue'

export default {
  components: {
    PanelData,
    TitleView,
    ProjectExecutionsTable,
  },
  data() {
    return {
      data: [],
      generalStore: useGeneralStore(),
      dateOptionSelected: null,
      labels: [
        {
          label: this.$t('versionHistory.today'),
          value: 'today',
          color: 'primary',
          isCustom: false,
        },
        {
          label: this.$t('versionHistory.yesterday'),
          value: 'yesterday',
          color: 'primary',
          isCustom: false,
        },
        {
          label: this.$t('versionHistory.last7days'),
          value: 'last7days',
          color: 'primary',
          isCustom: false,
        },
        {
          label: this.$t('versionHistory.lastMonth'),
          value: 'lastMonth',
          color: 'primary',
          isCustom: false,
        },
        {
          label: this.$t('versionHistory.custom'),
          value: 'custom',
          color: 'primary',
          isCustom: true,
        },
      ],
      selectedDates: {
        startDate: null,
        endDate: null,
      },
      customSelectedDates: {
        startDate: null,
        endDate: null,
      },
      showSnackbar: null,
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
  },
  mounted() {
    this.dateOptionSelected = this.labels[0].value
  },
  activated() {
    this.fetchData()
  },
  computed: {
    title() {
      return this.$t('versionHistory.title')
    },
    description() {
      return this.$t('versionHistory.description')
    },
  },
  watch: {
    dateOptionSelected(newVal) {
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const lastWeek = new Date(today)
      lastWeek.setDate(lastWeek.getDate() - 7)
      const lastMonth = new Date(today)
      lastMonth.setMonth(lastMonth.getMonth() - 1)
      this.customSelectedDates.startDate = null
      this.customSelectedDates.endDate = null

      switch (newVal) {
        case 'today':
          this.selectedDates.startDate = today
          this.selectedDates.endDate = today
          break
        case 'yesterday':
          this.selectedDates.startDate = yesterday
          this.selectedDates.endDate = yesterday
          break
        case 'last7days':
          this.selectedDates.startDate = lastWeek
          this.selectedDates.endDate = today
          break
        case 'lastMonth':
          this.selectedDates.startDate = lastMonth
          this.selectedDates.endDate = today
          break
        case 'custom':
          this.selectedDates.startDate = null
          this.selectedDates.endDate = null
          break
        default:
          this.selectedDates.startDate = null
          this.selectedDates.endDate = null
          this.data = []
          break
      }
    },
    customSelectedDates: {
      handler(newVal) {
        if (
          this.dateOptionSelected === 'custom' &&
          newVal.startDate &&
          newVal.endDate
        ) {
          this.selectedDates.startDate = new Date(newVal.startDate)
          this.selectedDates.endDate = new Date(newVal.endDate)
        }
      },
      deep: true,
    },
    selectedDates: {
      handler() {
        if (this.selectedDates.startDate && this.selectedDates.endDate) {
          this.fetchData()
        }
      },
      deep: true,
    },
  },
  methods: {
    async fetchData() {
      try {
        const result = await this.generalStore.fetchExecutionsByDateRange(
          this.selectedDates.startDate,
          this.selectedDates.endDate,
        )

        if (result) {
          this.showSnackbar(this.$t('projectExecution.snackbar.succesSearch'))
          this.data = this.formatData(result)
        } else {
          this.data = this.formatData([])
          this.showSnackbar(this.$t('projectExecution.snackbar.noDataSearch'))
        }
      } catch (error) {
        this.data = this.formatData([])
        this.showSnackbar(
          this.$t('projectExecution.snackbar.errorSearch'),
          'error',
        )
      }
    },
    formatData(rawData) {
      const formattedData = rawData.reduce((acc, item) => {
        const date = item.createdAt.split('T')[0]
        if (!acc[date]) {
          acc[date] = {
            date,
            data: [],
          }
        }
        acc[date].data.push({
          time: item.createdAt.split('T')[1].split('.')[0],
          ...item,
        })
        return acc
      }, {})
      return Object.values(formattedData)
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
          await this.fetchData()
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
  },
}
</script>

<style></style>
