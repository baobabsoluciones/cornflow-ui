<template>
  <div class="view-container history-execution-view">
    <CoreTitleView
      :icon="'mdi-history'"
      :title="title"
      :description="description"
      class="mb-4"
      :dropdown-items="dropdownMenuItems"
      @dropdown-item-click="handleDropdownItemClick"
    />

    <CorePanelData
      :data="filteredData"
      :checkboxOptions="labels"
      :language="locale"
      :noDataMessage="$t('versionHistory.noData')"
      @date-range-changed="dateOptionSelected = $event"
      class="overflow-y-auto"
    >
      <template #extra-filters>
        <v-col v-if="showReplannedFilter" cols="auto">
          <v-checkbox
            v-model="hideReplanned"
            :label="$t('versionHistory.hideReplanned')"
            color="primary"
            class="custom-checkbox"
          />
        </v-col>
      </template>
      <template #custom-checkbox>
        <div style="margin-top: -10px !important; display: flex">
          <v-col class="v-col-s-6 v-col-md-6 v-col-xl-3">
            <v-text-field
              :label="$t('versionHistory.from')"
              type="date"
              v-model="customSelectedDates.startDate"
            ></v-text-field>
          </v-col>
          <v-col class="v-col-s-6 v-col-md-6 v-col-xl-3">
            <v-text-field
              :label="$t('versionHistory.to')"
              type="date"
              v-model="customSelectedDates.endDate"
            ></v-text-field>
          </v-col>
        </div>
      </template>
      <template v-slot:table="slotProps">
        <div class="history-execution-table-scroll">
          <ProjectExecutionsTable
            :executionsByDate="slotProps.itemData"
            :showFooter="false"
            :showHeaders="slotProps.showHeaders"
            :formatDateByTime="true"
            :useFixedWidth="true"
            :loadingExecutions="loadingExecutions"
            @loadExecution="loadExecution"
            @deleteExecution="deleteExecution"
          ></ProjectExecutionsTable>
        </div>
      </template>
      <!--
        Override the default "no data" slot so we never show the empty-state
        message while a fetch is still in flight. Two reasons:
          1. UX: right after login `fetchData` runs once before any data has
             arrived; without this, users saw "no hay datos" for a fraction
             of a second and assumed there were no executions.
          2. Token race: if the API call beats the token being written to
             sessionStorage, the backend returns 401 ("signature"); the store
             catches it silently and returns undefined, which used to render
             as "no data" forever (until reload). We now retry once
             transparently in `fetchData`, and keep the spinner visible until
             it succeeds.
      -->
      <template v-slot:no-data>
        <output v-if="loadingData" class="history-loading" aria-live="polite">
          <v-progress-circular indeterminate color="primary" size="32" width="3" />
          <span class="history-loading__text">
            {{ $t('versionHistory.loading') }}
          </span>
        </output>
        <span v-else>{{ $t('versionHistory.noData') }}</span>
      </template>
    </CorePanelData>
  </div>
</template>

<script>
import ProjectExecutionsTable from '@/components/project-execution/ProjectExecutionsTable.vue'
import CoreButton from '@/components/core/CoreButton.vue'
import CoreTitleView from '@/components/core/CoreTitleView.vue'
import CorePanelData from '@/components/core/CorePanelData.vue'
import { useGeneralStore } from '@/stores/general'
import { inject } from 'vue'
import appConfig from '@/app/config'

export default {
  components: {
    ProjectExecutionsTable,
    CoreButton,
    CoreTitleView,
    CorePanelData,
  },
  data() {
    return {
      data: [],
      generalStore: useGeneralStore(),
      dateOptionSelected: null,
      selectedDates: {
        startDate: null,
        endDate: null,
      },
      customSelectedDates: {
        startDate: null,
        endDate: null,
      },
      showSnackbar: null,
      loadingExecutions: new Set(),
      hideReplanned: false,
      // Start `true` so the spinner is visible from the very first paint,
      // before `activated()` fires `fetchData`. Avoids the flash where
      // "no hay datos" briefly renders for users who just logged in.
      loadingData: true,
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
  },
  mounted() {
    this.dateOptionSelected = null
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
    locale() {
      return this.$i18n.locale
    },
    labels() {
      return [
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
      ]
    },
    showReplannedFilter() {
      return appConfig.getCore().parameters.enableRecalculationOnMasterEdit
    },
    filteredData() {
      if (!this.hideReplanned) return this.data
      return this.data
        .map((group) => ({
          ...group,
          data: group.data.filter((item) => !item.config?.replanning),
        }))
        .filter((group) => group.data.length > 0)
    },
    dropdownMenuItems() {
      return [
        {
          id: 'create-new-execution',
          title: this.$t('versionHistory.createNewExecution'),
          icon: 'mdi-plus',
          action: () => this.navigateToCreateExecution(),
        },
      ]
    },
  },
  watch: {
    dateOptionSelected(newVal, oldVal) {
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

      // Fetch data if custom option is selected and no dates are selected, otherwise data is setted to empty
      if (
        oldVal === 'custom' &&
        this.selectedDates.startDate === null &&
        this.selectedDates.endDate === null
      ) {
        this.fetchData()
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
        this.fetchData()
      },
      deep: true,
    },
  },
  methods: {
    navigateToCreateExecution() {
      this.$router.push('/project-execution')
    },
    handleDropdownItemClick(item) {
      if (item.action) {
        item.action()
      }
    },
    async fetchData(attempt = 0) {
      this.loadingData = true
      try {
        const result = await this.generalStore.fetchExecutionsByDateRange(
          this.selectedDates.startDate,
          this.selectedDates.endDate,
        )

        if (result) {
          this.showSnackbar(this.$t('projectExecution.snackbar.succesSearch'))
          this.data = this.formatData(result)
          return
        }

        // `result === undefined` only happens when the store swallowed an
        // exception (see `fetchExecutionsByDateRange` in stores/general.ts).
        // The most common cause right after login is a token-signature race:
        // this view's `activated()` hook fires before the auth token has
        // been written to sessionStorage, so the API rejects the request.
        // Retry once after a short delay before surfacing "no data" — by then
        // the token should be in place and the call succeeds transparently.
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 600))
          return this.fetchData(1)
        }

        this.data = this.formatData([])
        this.showSnackbar(this.$t('projectExecution.snackbar.noDataSearch'))
      } catch {
        this.data = this.formatData([])
        this.showSnackbar(
          this.$t('projectExecution.snackbar.errorSearch'),
          'error',
        )
      } finally {
        this.loadingData = false
      }
    },
    formatData(rawData) {
      const formattedData = rawData.reduce((acc, item) => {
        // Check if createdAt exists and is a valid string
        if (!item.createdAt || typeof item.createdAt !== 'string') {
          return acc
        }

        const date = item.createdAt.split('T')[0]
        if (!acc[date]) {
          acc[date] = {
            date,
            data: [],
          }
        }
        const timeParts = item.createdAt.split('T')[1]?.split(':')
        if (!timeParts || timeParts.length < 2) {
          return acc
        }
        const formattedTime = `${timeParts[0]}:${String(timeParts[1]).padStart(2, '0')}`
        acc[date].data.push({
          time: formattedTime,
          ...item,
        })
        return acc
      }, {})
      return Object.values(formattedData)
    },
    async loadExecution(execution) {
      this.loadingExecutions.add(execution.id)
      try {
        const loadedResult = await this.generalStore.fetchLoadedExecution(
          execution.id,
        )

        if (loadedResult) {
          this.generalStore.setSelectedExecution(execution.id)
          // Update tabs and ensure they are properly initialized
          const existingTab = this.generalStore.getLoadedExecutionTabs.find(
            (tab) => tab.value === execution.id,
          )

          if (existingTab) {
            this.generalStore.getLoadedExecutionTabs.forEach((tab) => {
              tab.selected = tab.value === execution.id
            })
          } else {
            this.generalStore.addLoadedExecutionTab({
              value: execution.id,
              selected: true,
              name: execution.name || `Execution ${execution.id}`,
            })
          }

          this.generalStore.incrementTabBarKey()
          this.showSnackbar(this.$t('projectExecution.snackbar.successLoad'))
        } else {
          this.showSnackbar(
            this.$t('projectExecution.snackbar.errorLoad'),
            'error',
          )
        }
      } catch {
        this.showSnackbar(
          this.$t('projectExecution.snackbar.errorLoad'),
          'error',
        )
      } finally {
        this.loadingExecutions.delete(execution.id)
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
      } catch {
        this.showSnackbar(
          this.$t('projectExecution.snackbar.errorDelete'),
          'error',
        )
      }
    },
  },
}
</script>

<style>
.history-execution-view {
  /* The table now fits its container (table-layout: fixed + width: 100%),
     so the view no longer needs to scroll horizontally. */
  overflow-x: hidden;
}

.history-execution-table-scroll {
  width: 100%;
  box-sizing: border-box;
}

.history-execution-view :deep(.v-expansion-panel-text),
.history-execution-view :deep(.v-expansion-panel-text__wrapper) {
  overflow: visible !important;
  padding-right: 0 !important;
}

.history-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px;
}

.history-loading__text {
  font-size: 13px;
  font-weight: 500;
  color: var(--subtitle, rgba(0, 0, 0, 0.6));
}
</style>
