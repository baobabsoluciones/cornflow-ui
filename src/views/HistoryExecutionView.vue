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
            :deletingExecutions="deletingExecutions"
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
import ProjectExecutionsTable from '@cornflow-ui/core/components/project-execution/ProjectExecutionsTable.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreTitleView from '@cornflow-ui/core/components/core/CoreTitleView.vue'
import CorePanelData from '@cornflow-ui/core/components/core/CorePanelData.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
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
      deletingExecutions: new Set(),
      // Coalesce overlapping list fetches (see `fetchData`).
      fetchInFlight: false,
      fetchQueued: false,
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
    // Make sure the background poller is running so rows that are still loading
    // flip to their final state while the user watches the history — even if
    // the list request itself is failing. `loadedExecutionsSignature` then
    // syncs those state changes into the table.
    this.generalStore.autoLoadExecutions()
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
    /**
     * Signature of the store's tracked executions (id + state). Changes only
     * when an execution transitions state (the background poller updates
     * `loadedExecutions` on transition), which is exactly when the history
     * table needs to refresh its status chips.
     */
    loadedExecutionsSignature() {
      return this.generalStore.loadedExecutions
        .map((execution) => `${execution.executionId}:${execution.state}`)
        .join('|')
    },
  },
  watch: {
    // Keep the history rows in sync with the live execution state held in the
    // store. Without this, a row launched while the user is on this view stays
    // stuck on "Loading" forever: the table is a one-shot snapshot from
    // `fetchData`, while the actual completion is detected by the store poller.
    loadedExecutionsSignature() {
      this.syncExecutionStatesFromStore()
    },
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
      // Coalesce overlapping fetches. A single user action (picking a date
      // option, typing custom dates) can fire several watchers, and each list
      // query can be slow/heavy on the backend. Keep at most one request in
      // flight plus one trailing refetch (with the latest dates) so we don't
      // pile duplicate queries onto a backend that is already struggling while
      // an execution is running.
      if (attempt === 0) {
        if (this.fetchInFlight) {
          this.fetchQueued = true
          return
        }
        this.fetchInFlight = true
        // Show the "loading" state (not the previous rows) until the new data
        // actually arrives.
        this.data = []
      }
      this.loadingData = true
      try {
        const result = await this.generalStore.fetchExecutionsByDateRange(
          this.selectedDates.startDate,
          this.selectedDates.endDate,
        )

        if (result) {
          this.showSnackbar(this.$t('projectExecution.snackbar.succesSearch'))
          this.data = this.formatData(result)
          // Overlay the freshest known state from the store so rows reflect any
          // execution that has already finished/transitioned since the list was
          // built on the backend.
          this.syncExecutionStatesFromStore()
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
          return await this.fetchData(1)
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
        if (attempt === 0) {
          this.fetchInFlight = false
          // If a fetch was requested while this one ran, run it once now with
          // whatever the current dates are.
          if (this.fetchQueued) {
            this.fetchQueued = false
            this.fetchData()
          }
        }
      }
    },
    /**
     * Updates the state of the displayed rows from the store's tracked
     * executions. The background poller keeps `loadedExecutions` current, so a
     * row that was "Loading" when fetched flips to its final state here without
     * needing another (possibly queued/stalled) list request.
     */
    syncExecutionStatesFromStore() {
      const stateById = new Map(
        this.generalStore.loadedExecutions.map((execution) => [
          execution.executionId,
          execution.state,
        ]),
      )
      this.applyExecutionStates(stateById)
    },
    /**
     * Applies a map of executionId -> state onto the displayed rows. Reassigns
     * `this.data` with fresh references only when something actually changed,
     * so the table re-renders the status chips (and we avoid needless churn).
     */
    applyExecutionStates(stateById) {
      let changed = false
      const next = this.data.map((group) => ({
        ...group,
        data: group.data.map((item) => {
          const nextState = stateById.get(item.id)
          if (nextState !== undefined && nextState !== item.state) {
            changed = true
            return { ...item, state: nextState }
          }
          return item
        }),
      }))
      if (changed) {
        this.data = next
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
      // Mark the row as deleting so its action shows a spinner instead of the
      // trash icon while the (sometimes slow) DELETE + refetch is in flight.
      this.deletingExecutions.add(execution.id)
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
      } finally {
        this.deletingExecutions.delete(execution.id)
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
