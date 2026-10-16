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

    <section class="history-card">
      <div class="history-filters">
        <div class="history-filters__row">
          <v-text-field
            v-model="historyFilters.state.search"
            class="history-filters__search"
            prepend-inner-icon="mdi-magnify"
            :placeholder="$t('versionHistory.filterBar.search')"
            variant="outlined"
            density="compact"
            hide-details
            clearable
            data-testid="history-search"
          />
          <FilterChip
            v-for="filter in visibleFilters"
            :key="filter.key"
            :label="filterLabel(filter)"
            :icon="filter.icon || 'mdi-filter-variant'"
            :value="generalStore.executionFilterValues[filter.key] ?? null"
            :options="filterOptions(filter)"
            :all-label="$t('versionHistory.filterAll')"
            :data-testid="`history-filter-${filter.key}`"
            @pick="pickFilterValue(filter, $event)"
          />
          <DateFilterChip
            v-model="dateOptionSelected"
            v-model:from="customSelectedDates.startDate"
            v-model:to="customSelectedDates.endDate"
            :label="$t('versionHistory.filterBar.date')"
            :presets="datePresets"
            :from-label="$t('versionHistory.from')"
            :to-label="$t('versionHistory.to')"
            data-testid="history-filter-date"
          />
          <FilterChip
            v-for="definition in historyFilters.addedDefinitions"
            :key="definition.key"
            :label="$t(definition.labelKey)"
            :icon="definition.icon"
            :value="historyFilters.state.picked[definition.key] ?? null"
            :options="historyFilters.optionsOf(definition.key, rows)"
            :all-label="$t('versionHistory.filterAll')"
            show-counts
            removable
            :remove-label="$t('versionHistory.filterBar.remove')"
            :auto-open="definition.key === justAddedFilter"
            :data-testid="`history-filter-${definition.key}`"
            @pick="historyFilters.pick(definition.key, $event)"
            @remove="historyFilters.remove(definition.key)"
          />
          <AddFilterMenu
            v-if="addFilterGroups.length > 0"
            :label="$t('versionHistory.filterBar.addFilter')"
            :search-placeholder="$t('versionHistory.filterBar.searchField')"
            :no-matches-text="$t('versionHistory.filterBar.noFields')"
            :groups="addFilterGroups"
            data-testid="history-add-filter"
            @add="addHistoryFilter"
          />
        </div>
        <button
          v-if="anyFilterActive"
          type="button"
          class="history-filters__clear"
          data-testid="history-clear-filters"
          @click="clearFilters"
        >
          {{ $t('versionHistory.filterBar.clear') }}
        </button>
      </div>

      <div class="history-summary" data-testid="history-summary">
        <span>{{ $t('versionHistory.filterBar.count', executionCount) }}</span>
        <span v-if="limitReached" class="history-summary__notice">
          · {{ $t('versionHistory.filterBar.limitNotice', { limit: listLimit }) }}
        </span>
      </div>

      <div v-if="filteredData.length > 0" class="history-table">
        <!-- One header for every day: the day tables below share its column widths. -->
        <div class="history-table__head">
          <ProjectExecutionsTable
            :executionsByDate="[]"
            :showFooter="false"
            :showHeaders="true"
            :formatDateByTime="true"
            :useFixedWidth="true"
          />
        </div>
        <template v-for="group in filteredData" :key="group.date">
          <div class="history-table__day" data-testid="history-day">
            <span class="history-table__day-date">{{ dayTitle(group.date) }}</span>
            <span class="history-table__day-count">{{
              $t('versionHistory.filterBar.count', group.data.length)
            }}</span>
          </div>
          <ProjectExecutionsTable
            :executionsByDate="group.data"
            :showFooter="false"
            :showHeaders="false"
            :formatDateByTime="true"
            :useFixedWidth="true"
            :loadingExecutions="loadingExecutions"
            :deletingExecutions="deletingExecutions"
            @loadExecution="loadExecution"
            @deleteExecution="deleteExecution"
          />
        </template>
      </div>
      <!--
        Never show the empty-state message while a fetch is still in flight:
        right after login `fetchData` runs once before any data has arrived,
        and a token race can make the first request fail; `fetchData` retries
        once and the spinner stays until it succeeds.
      -->
      <div v-else class="history-empty">
        <output v-if="loadingData" class="history-loading" aria-live="polite">
          <v-progress-circular indeterminate color="primary" size="32" width="3" />
          <span class="history-loading__text">
            {{ $t('versionHistory.loading') }}
          </span>
        </output>
        <span v-else>{{ $t('versionHistory.noData') }}</span>
      </div>
    </section>
  </div>
</template>

<script>
import ProjectExecutionsTable from '@cornflow-ui/core/components/project-execution/ProjectExecutionsTable.vue'
import CoreTitleView from '@cornflow-ui/core/components/core/CoreTitleView.vue'
import FilterChip from '@cornflow-ui/core/components/core/filters/FilterChip.vue'
import DateFilterChip from '@cornflow-ui/core/components/core/filters/DateFilterChip.vue'
import AddFilterMenu from '@cornflow-ui/core/components/core/filters/AddFilterMenu.vue'
import { useExecutionHistoryFilters } from '@cornflow-ui/core/composables/project-execution/useExecutionHistoryFilters'
import { EXECUTIONS_LIST_LIMIT } from '@cornflow-ui/core/repositories/ExecutionRepository'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import {
  formatLocalDateKey,
  formatLocalTimeHHmm,
  parseLocalDateKey,
} from '@cornflow-ui/core/utils/date'
import { formatDateForHeaders } from '@cornflow-ui/core/utils/data_io'
import { inject } from 'vue'

/** Date range the history opens with. */
const DEFAULT_DATE_OPTION = 'lastMonth'

export default {
  components: {
    ProjectExecutionsTable,
    CoreTitleView,
    FilterChip,
    DateFilterChip,
    AddFilterMenu,
  },
  setup() {
    return { historyFilters: useExecutionHistoryFilters() }
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
      // Pending id of the fetchData retry timer, cleared on unmount/deactivate so a
      // late retry can't run on a torn-down component (would call `$t` on nothing).
      fetchRetryTimer: null,
      // Filter added last, whose menu opens as it appears.
      justAddedFilter: null,
      listLimit: EXECUTIONS_LIST_LIMIT,
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
    this.dateOptionSelected = DEFAULT_DATE_OPTION
  },
  activated() {
    this.fetchData()
    // Make sure the background poller is running so rows that are still loading
    // flip to their final state while the user watches the history — even if
    // the list request itself is failing. `loadedExecutionsSignature` then
    // syncs those state changes into the table.
    this.generalStore.autoLoadExecutions()
  },
  deactivated() {
    this.clearFetchRetryTimer()
  },
  beforeUnmount() {
    this.clearFetchRetryTimer()
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
    datePresets() {
      return this.labels.map(({ label, value }) => ({ label, value }))
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
    /** Executions history filters with options (none without their frontend-automation table). */
    visibleFilters() {
      return this.generalStore.getExecutionFilters.filter(
        (filter) => this.filterOptions(filter).length > 0,
      )
    },
    /** Picked filters as one value, so a change lists the executions again. */
    filterParamsSignature() {
      return JSON.stringify(this.generalStore.getExecutionFilterParams)
    },
    /** Every loaded execution, across days. */
    rows() {
      return this.data.flatMap((group) => group.data)
    },
    /** The days with the executions that pass the search and the added filters. */
    filteredData() {
      return this.data
        .map((group) => ({
          ...group,
          data: this.historyFilters.filterRows(group.data),
        }))
        .filter((group) => group.data.length > 0)
    },
    executionCount() {
      return this.filteredData.reduce((total, group) => total + group.data.length, 0)
    },
    /** The list came back full: older executions in the range are not loaded. */
    limitReached() {
      return Boolean(this.selectedDates.startDate) && this.rows.length >= EXECUTIONS_LIST_LIMIT
    },
    /** Filters the user can still add, by group. */
    addFilterGroups() {
      return ['execution', 'solution']
        .map((group) => ({
          key: group,
          title: this.$t(`versionHistory.filterBar.groups.${group}`),
          fields: this.historyFilters.availableDefinitions
            .filter((definition) => definition.group === group)
            .map((definition) => ({
              key: definition.key,
              title: this.$t(definition.labelKey),
              icon: definition.icon,
            })),
        }))
        .filter((group) => group.fields.length > 0)
    },
    /** Anything away from how the history opens: search, filters or another date range. */
    anyFilterActive() {
      return (
        this.historyFilters.isActive ||
        this.dateOptionSelected !== DEFAULT_DATE_OPTION ||
        Object.keys(this.generalStore.getExecutionFilterParams).length > 0
      )
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
    filterParamsSignature() {
      this.fetchData()
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
          this.selectedDates.startDate = parseLocalDateKey(newVal.startDate)
          this.selectedDates.endDate = parseLocalDateKey(newVal.endDate)
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
    filterOptions(filter) {
      return this.generalStore.executionFilterOptions[filter.key] ?? []
    },
    filterLabel(filter) {
      return this.$te(filter.labelKey) ? this.$t(filter.labelKey) : filter.labelKey
    },
    pickFilterValue(filter, value) {
      this.generalStore.setExecutionFilterValue(filter.key, value)
    },
    addHistoryFilter(key) {
      this.historyFilters.add(key)
      this.justAddedFilter = key
    },
    /** Back to how the history opens: no search, no filters, the default date range. */
    clearFilters() {
      this.historyFilters.clear()
      this.justAddedFilter = null
      for (const key of Object.keys(this.generalStore.getExecutionFilterParams)) {
        this.generalStore.setExecutionFilterValue(key, null)
      }
      this.dateOptionSelected = DEFAULT_DATE_OPTION
    },
    dayTitle(date) {
      return formatDateForHeaders(date, this.locale)
    },
    navigateToCreateExecution() {
      this.$router.push('/project-execution')
    },
    handleDropdownItemClick(item) {
      if (item.action) {
        item.action()
      }
    },
    clearFetchRetryTimer() {
      if (this.fetchRetryTimer) {
        clearTimeout(this.fetchRetryTimer)
        this.fetchRetryTimer = null
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
          await new Promise((resolve) => {
            this.fetchRetryTimer = setTimeout(resolve, 600)
          })
          this.fetchRetryTimer = null
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

        // Group by the user's local day (createdAt is already normalised to
        // UTC by the repository), so executions launched around midnight land
        // on the day the user actually launched them.
        const date = formatLocalDateKey(item.createdAt)
        if (!date) {
          return acc
        }
        if (!acc[date]) {
          acc[date] = {
            date,
            data: [],
          }
        }
        const formattedTime = formatLocalTimeHHmm(item.createdAt)
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
  /* The table fits its container (table-layout: fixed + width: 100%), so the
     view does not need to scroll horizontally. */
  overflow-x: hidden;
}

.history-card {
  border-radius: 16px;
  background-color: #fff;
  box-shadow: 0 1px 3px rgba(16, 24, 40, 0.08);
  overflow: hidden;
}

.history-filters {
  padding: 20px 28px 16px;
}

.history-filters__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.history-filters__search {
  flex: 0 1 320px;
  min-width: 220px;
}

.history-filters__search .v-field {
  border-radius: 10px;
}

.history-filters__search .v-field__input {
  min-height: 44px;
}

.history-filters__clear {
  margin-top: 12px;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--primary);
}

.history-filters__clear:hover {
  text-decoration: underline;
}

.history-summary {
  padding: 12px 28px;
  border-top: 1px solid #eceef2;
  border-bottom: 1px solid #eceef2;
  background-color: #f8f9fb;
  font-size: 0.875rem;
  color: var(--subtitle);
}

.history-summary__notice {
  color: var(--warning, #b26a00);
}

.history-table {
  padding: 0 8px 8px;
}

/* The header-only table shows its column titles and nothing else. */
.history-table__head .v-data-table-rows-no-data {
  display: none;
}

.history-table .v-table thead th {
  border-left: none !important;
  border-right: none !important;
  background-color: #fff !important;
  font-weight: 600 !important;
  color: var(--title) !important;
}

/* Spacer rows of the virtual table take no room, so the days follow each other closely. */
.history-table tbody > tr[style*='height: 0px'] > td {
  padding: 0 !important;
  border: 0 !important;
  line-height: 0 !important;
}

.history-table__day {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid #eceef2;
  border-bottom: 1px solid #eceef2;
  background-color: #f8f9fb;
}

.history-table__day-date {
  font-weight: 700;
  color: var(--title);
}

.history-table__day-count {
  font-size: 0.8125rem;
  color: var(--subtitle);
}

.history-empty {
  display: flex;
  justify-content: center;
  padding: 32px;
  color: var(--subtitle);
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
