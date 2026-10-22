<template>
  <div
    ref="root"
    class="view-container history-execution-view"
    :class="{ 'is-narrow': narrow }"
  >
    <CoreTitleView
      icon="mdi-history"
      :title="title"
      :description="narrow && selectedExecution ? '' : description"
      class="history-title"
    >
      <template #actions>
        <CoreButton
          variant="outlined"
          icon="mdi-plus"
          :text="$t('versionHistory.createNewExecution')"
          data-testid="history-create-execution"
          @click="navigateToCreateExecution"
        />
      </template>
    </CoreTitleView>

    <div class="history-layout">
      <section
        v-if="showList"
        class="history-panel history-list"
        :aria-busy="loadingData"
      >
        <div class="history-filters">
          <CoreSearchInput
            v-model="historyFilters.state.search"
            block
            :debounce="0"
            :show-shortcut="false"
            :placeholder="$t('versionHistory.filterBar.search')"
            data-testid="history-search"
          />
          <div class="history-filters__chips">
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
              v-for="filter in visibleFilters"
              :key="filter.key"
              :label="filterLabel(filter)"
              :icon="filter.icon"
              :value="generalStore.executionFilterValues[filter.key] ?? null"
              :options="filterOptions(filter)"
              :all-label="$t('versionHistory.filterAll')"
              :data-testid="`history-filter-${filter.key}`"
              @pick="pickFilterValue(filter, $event)"
            />
          </div>
          <div class="history-filters__chips">
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
          <div class="history-summary" data-testid="history-summary">
            <span aria-live="polite">{{
              loadingData
                ? $t('versionHistory.loading')
                : $t('versionHistory.filterBar.count', executionCount)
            }}</span>
            <button
              v-if="anyFilterActive"
              type="button"
              class="history-summary__clear"
              data-testid="history-clear-filters"
              @click="clearFilters"
            >
              {{ $t('versionHistory.filterBar.clear') }}
            </button>
          </div>
        </div>

        <div class="history-list__scroll">
          <div
            v-if="loadingData"
            class="history-skeleton"
            data-testid="history-loading"
          >
            <div v-for="row in 5" :key="row" class="history-skeleton__row">
              <CoreSkeleton :width="18" :height="18" shape="circle" />
              <div class="history-skeleton__lines">
                <CoreSkeleton :width="`${50 + ((row * 13) % 30)}%`" />
                <CoreSkeleton
                  :width="`${70 + ((row * 7) % 25)}%`"
                  :height="10"
                />
                <CoreSkeleton width="40%" :height="10" />
              </div>
            </div>
          </div>
          <CoreEmptyState
            v-else-if="rows.length === 0"
            class="history-empty"
            icon="mdi-history"
            :title="$t('versionHistory.list.emptyTitle')"
            :text="$t('versionHistory.list.emptyText')"
          />
          <CoreEmptyState
            v-else-if="filteredData.length === 0"
            class="history-empty"
            icon="mdi-filter-remove-outline"
            :title="$t('versionHistory.list.noResultsTitle')"
            :text="$t('versionHistory.list.noResultsText')"
            :action-label="$t('versionHistory.filterBar.clear')"
            @action="clearFilters"
          />
          <template v-else>
            <CoreAlert
              v-if="limitReached"
              class="history-limit"
              tone="info"
              :message="
                $t('versionHistory.filterBar.limitNotice', { limit: listLimit })
              "
              :action-label="
                canNarrowToLastWeek ? $t('versionHistory.list.limitAction') : ''
              "
              @action="dateOptionSelected = 'last7days'"
            />
            <ExecutionList
              :groups="executionDays"
              :selected-id="selectedExecutionId"
              :is-current-plan="isLatestPlan"
              :loading-ids="loadingExecutions"
              :downloading-ids="downloadingExecutions"
              :actions-always="narrow"
              :preview="!narrow"
              :now="now"
              @select="selectExecution"
              @load="loadExecution"
              @excel="downloadExcel"
            />
          </template>
        </div>
      </section>

      <section
        v-if="showDetail"
        class="history-panel history-detail"
        data-testid="history-detail"
      >
        <div v-if="loadingData" class="history-detail__skeleton">
          <CoreSkeleton width="40%" :height="20" />
          <CoreSkeleton width="60%" />
          <div class="history-detail__skeleton-row">
            <CoreSkeleton :width="110" :height="24" shape="pill" />
            <CoreSkeleton :width="110" :height="24" shape="pill" />
          </div>
          <div class="history-detail__skeleton-row">
            <CoreSkeleton :width="160" :height="36" shape="block" />
            <CoreSkeleton :width="150" :height="36" shape="block" />
          </div>
        </div>
        <CoreEmptyState
          v-else-if="!selectedExecution"
          class="history-detail__empty"
          icon="mdi-cursor-default-click-outline"
          :title="$t('versionHistory.detail.noSelectionTitle')"
          :text="$t('versionHistory.detail.noSelectionText')"
        />
        <template v-else>
          <div class="history-detail__section history-detail__section--head">
            <ExecutionDetailHeader
              :execution="selectedExecution"
              :current-plan="isLatestPlan(selectedExecution.id)"
              :can-set-current-plan="canSetCurrentPlan(selectedExecution)"
              :loading="loadingExecutions.has(selectedExecution.id)"
              :downloading="downloadingExecutions.has(selectedExecution.id)"
              :deleting="deletingExecutions.has(selectedExecution.id)"
              :show-back="narrow"
              @load="loadExecution(selectedExecution)"
              @excel="downloadExcel(selectedExecution)"
              @set-current-plan="openSetLatestPlan(selectedExecution)"
              @delete="askDelete(selectedExecution)"
              @back="selectedExecutionId = null"
            />
          </div>
          <div class="history-detail__section">
            <CoreTimeline
              :title="$t('versionHistory.detail.progress')"
              :steps="executionDetails.timelineSteps(selectedExecution, now)"
            />
          </div>
          <div class="history-detail__section">
            <CoreDescriptionList
              :title="$t('versionHistory.detail.data')"
              :items="executionDetails.dataItems(selectedExecution, now)"
              :min-column-width="150"
            />
          </div>
          <div
            v-if="selectedParameters.length > 0"
            class="history-detail__section"
          >
            <CoreDescriptionList
              :title="$t('versionHistory.detail.parameters')"
              :items="selectedParameters"
              :min-column-width="150"
            />
          </div>
        </template>
      </section>
    </div>

    <CoreConfirmDialog
      :model-value="executionToDelete !== null"
      :title="$t('versionHistory.detail.deleteTitle')"
      :message="
        $t('versionHistory.detail.deleteMessage', {
          name: executionToDelete?.name ?? '',
        })
      "
      :confirm-text="$t('executionTable.deleteButton')"
      :cancel-text="$t('executionTable.cancelButton')"
      confirm-color="var(--danger)"
      icon="mdi-delete-outline"
      :loading="
        executionToDelete !== null &&
        deletingExecutions.has(executionToDelete.id)
      "
      @confirm="confirmDelete"
      @cancel="executionToDelete = null"
    />

    <!-- Set latest plan modal (premium component injected via the latest-plan capability) -->
    <component
      :is="latestPlan.setLatestPlanModalComponent"
      v-if="latestPlanCandidate && latestPlan.setLatestPlanModalComponent"
      v-model="showLatestPlanModal"
      :execution-id="latestPlanCandidate.id"
      :execution-name="latestPlanCandidate.name"
      @success="handleLatestPlanSuccess"
      @error="handleLatestPlanError"
    />
  </div>
</template>

<script>
import CoreAlert from '@cornflow-ui/core/components/core/CoreAlert.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreDescriptionList from '@cornflow-ui/core/components/core/CoreDescriptionList.vue'
import CoreEmptyState from '@cornflow-ui/core/components/core/CoreEmptyState.vue'
import CoreSkeleton from '@cornflow-ui/core/components/core/CoreSkeleton.vue'
import CoreTimeline from '@cornflow-ui/core/components/core/CoreTimeline.vue'
import CoreTitleView from '@cornflow-ui/core/components/core/CoreTitleView.vue'
import CoreConfirmDialog from '@cornflow-ui/core/components/core/table/CoreConfirmDialog.vue'
import CoreSearchInput from '@cornflow-ui/core/components/core/table/CoreSearchInput.vue'
import FilterChip from '@cornflow-ui/core/components/core/filters/FilterChip.vue'
import DateFilterChip from '@cornflow-ui/core/components/core/filters/DateFilterChip.vue'
import AddFilterMenu from '@cornflow-ui/core/components/core/filters/AddFilterMenu.vue'
import ExecutionDetailHeader from '@cornflow-ui/core/components/project-execution/ExecutionDetailHeader.vue'
import ExecutionList from '@cornflow-ui/core/components/project-execution/ExecutionList.vue'
import { useExecutionHistoryFilters } from '@cornflow-ui/core/composables/project-execution/useExecutionHistoryFilters'
import { useExecutionDetails } from '@cornflow-ui/core/composables/project-execution/useExecutionDetails'
import { isExecutionActive } from '@cornflow-ui/core/composables/project-execution/useExecutionStatus'
import { useLatestPlanController } from '@cornflow-ui/core/composables/project-execution/useLatestPlanController'
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

/** Below this width (px) the list and the detail take turns instead of sitting side by side. */
const NARROW_WIDTH = 860

export default {
  components: {
    AddFilterMenu,
    CoreAlert,
    CoreButton,
    CoreConfirmDialog,
    CoreDescriptionList,
    CoreEmptyState,
    CoreSearchInput,
    CoreSkeleton,
    CoreTimeline,
    CoreTitleView,
    DateFilterChip,
    ExecutionDetailHeader,
    ExecutionList,
    FilterChip,
  },
  setup() {
    return {
      historyFilters: useExecutionHistoryFilters(),
      executionDetails: useExecutionDetails(),
      // latest-plan controller injected by the premium module; inert when the module is absent.
      latestPlan: useLatestPlanController(),
    }
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
      downloadingExecutions: new Set(),
      // Coalesce overlapping list fetches (see `fetchData`).
      fetchInFlight: false,
      fetchQueued: false,
      // Pending id of the fetchData retry timer, cleared on unmount/deactivate so a
      // late retry can't run on a torn-down component (would call `$t` on nothing).
      fetchRetryTimer: null,
      // Filter added last, whose menu opens as it appears.
      justAddedFilter: null,
      listLimit: EXECUTIONS_LIST_LIMIT,
      // Start `true` so the skeleton is visible from the very first paint,
      // before `activated()` fires `fetchData`. Avoids the flash where
      // "no executions" briefly renders for users who just logged in.
      loadingData: true,
      selectedExecutionId: null,
      executionToDelete: null,
      latestPlanCandidate: null,
      showLatestPlanModal: false,
      narrow: false,
      resizeObserver: null,
      // Current time, ticking while the view is shown, for the live durations of running executions.
      now: Date.now(),
      clockTimer: null,
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
  },
  mounted() {
    this.dateOptionSelected = DEFAULT_DATE_OPTION
    this.observeWidth()
    this.executionDetails.loadParameterOptions()
  },
  activated() {
    this.fetchData()
    // Make sure the background poller is running so rows that are still loading
    // flip to their final state while the user watches the history — even if
    // the list request itself is failing. `loadedExecutionsSignature` then
    // syncs those state changes into the list.
    this.generalStore.autoLoadExecutions()
    this.startClock()
  },
  deactivated() {
    this.clearFetchRetryTimer()
    this.stopClock()
  },
  beforeUnmount() {
    this.clearFetchRetryTimer()
    this.stopClock()
    this.resizeObserver?.disconnect()
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
    /** The filtered days, newest first, as the list shows them. */
    executionDays() {
      return this.filteredData
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((group) => ({
          key: group.date,
          label: this.dayTitle(group.date),
          executions: group.data
            .slice()
            .sort((a, b) =>
              String(b.createdAt).localeCompare(String(a.createdAt)),
            ),
        }))
    },
    executionCount() {
      return this.filteredData.reduce(
        (total, group) => total + group.data.length,
        0,
      )
    },
    /** The list came back full: older executions in the range are not loaded. */
    limitReached() {
      return (
        Boolean(this.selectedDates.startDate) &&
        this.rows.length >= EXECUTIONS_LIST_LIMIT
      )
    },
    /** The range is wider than a week, so narrowing to the last 7 days lists fewer executions. */
    canNarrowToLastWeek() {
      return ['lastMonth', 'custom'].includes(this.dateOptionSelected)
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
    selectedExecution() {
      return (
        this.rows.find(
          (execution) => execution.id === this.selectedExecutionId,
        ) ?? null
      )
    },
    selectedParameters() {
      return this.selectedExecution
        ? this.executionDetails.parameterItems(this.selectedExecution)
        : []
    },
    /** On a narrow screen the detail replaces the list while an execution is selected. */
    showList() {
      return !this.narrow || !this.selectedExecution
    },
    showDetail() {
      return !this.narrow || Boolean(this.selectedExecution)
    },
    /**
     * Signature of the store's tracked executions (id + state). Changes only
     * when an execution transitions state (the background poller updates
     * `loadedExecutions` on transition), which is exactly when the history
     * needs to refresh its states.
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
    // stuck on "Loading" forever: the list is a one-shot snapshot from
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
    // On a wide screen the detail always shows an execution: the newest one, until the user picks.
    executionDays() {
      this.selectFirstExecutionIfNone()
    },
    narrow() {
      this.selectFirstExecutionIfNone()
    },
  },
  methods: {
    filterOptions(filter) {
      return this.generalStore.executionFilterOptions[filter.key] ?? []
    },
    filterLabel(filter) {
      return this.$te(filter.labelKey)
        ? this.$t(filter.labelKey)
        : filter.labelKey
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
      for (const key of Object.keys(
        this.generalStore.getExecutionFilterParams,
      )) {
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
    selectExecution(id) {
      this.selectedExecutionId = id
    },
    selectFirstExecutionIfNone() {
      if (this.narrow || this.selectedExecution) return
      this.selectedExecutionId =
        this.executionDays[0]?.executions[0]?.id ?? null
    },
    /** Watches the view's width: below `NARROW_WIDTH` the list and the detail take turns. */
    observeWidth() {
      if (!this.$refs.root || typeof ResizeObserver === 'undefined') return
      this.resizeObserver = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width ?? 0
        // A width of 0 is a view not laid out yet (or a test): keep the wide layout.
        this.narrow = width > 0 && width < NARROW_WIDTH
      })
      this.resizeObserver.observe(this.$refs.root)
    },
    startClock() {
      this.stopClock()
      this.now = Date.now()
      this.clockTimer = setInterval(() => {
        if (this.rows.some((execution) => isExecutionActive(execution.state))) {
          this.now = Date.now()
        }
      }, 1000)
    },
    stopClock() {
      if (this.clockTimer) {
        clearInterval(this.clockTimer)
        this.clockTimer = null
      }
    },
    isLatestPlan(id) {
      return this.latestPlan.isLatestPlan(id)
    },
    canSetCurrentPlan(execution) {
      return (
        this.latestPlan.isSetLatestPlanAvailable() &&
        this.latestPlan.canSetAsLatestPlan(execution.state) &&
        !this.latestPlan.isLatestPlan(execution.id)
      )
    },
    openSetLatestPlan(execution) {
      this.latestPlanCandidate = {
        id: execution.id,
        name: execution.name || `Execution ${execution.id}`,
      }
      this.showLatestPlanModal = true
    },
    handleLatestPlanSuccess() {
      this.showSnackbar(this.$t('latestPlan.snackbar.success'), 'success')
    },
    handleLatestPlanError(message) {
      this.showSnackbar(
        message || this.$t('latestPlan.snackbar.error'),
        'error',
      )
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
     * so the list re-renders the states (and we avoid needless churn).
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
    async downloadExcel(execution) {
      this.downloadingExecutions.add(execution.id)
      try {
        await this.generalStore.getDataToDownload(execution.id, true, true)
      } catch {
        this.showSnackbar(
          this.$t('inputOutputData.errorDownloadingExcel'),
          'error',
        )
      } finally {
        this.downloadingExecutions.delete(execution.id)
      }
    },
    askDelete(execution) {
      this.executionToDelete = execution
    },
    async confirmDelete() {
      const execution = this.executionToDelete
      if (!execution) return
      await this.deleteExecution(execution)
      this.executionToDelete = null
    },
    async deleteExecution(execution) {
      // Mark the execution as deleting so its action shows a spinner while the
      // (sometimes slow) DELETE + refetch is in flight.
      this.deletingExecutions.add(execution.id)
      try {
        const result = await this.generalStore.deleteExecution(execution.id)

        if (result) {
          if (this.selectedExecutionId === execution.id) {
            this.selectedExecutionId = null
          }
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

<style scoped>
.history-execution-view {
  gap: calc(var(--spacing) * 4);
  font-family: var(--font-sans);
}

/* The list and the detail fill the height the view leaves under the title, and scroll inside. */
.history-layout {
  display: grid;
  flex: 1;
  grid-template-columns: 400px minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: calc(var(--spacing) * 4);
  min-height: 420px;
}

.is-narrow .history-layout {
  grid-template-columns: minmax(0, 1fr);
}

.history-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.history-filters {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2);
  padding: calc(var(--spacing) * 3.5);
  border-bottom: 1px solid var(--color-divider);
}

.history-filters__chips {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--spacing) * 1.5);
}

.history-filters__chips:empty {
  display: none;
}

.history-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--spacing) * 2);
  min-height: 20px;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.history-summary__clear {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
  cursor: pointer;
}

.history-summary__clear:hover {
  text-decoration: underline;
}

.history-summary__clear:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.history-list__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 calc(var(--spacing) * 2) calc(var(--spacing) * 2.5);
}

.history-limit {
  margin: calc(var(--spacing) * 2.5) calc(var(--spacing) * 0.5)
    calc(var(--spacing) * 0.5);
}

.history-skeleton {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
  padding: calc(var(--spacing) * 3) calc(var(--spacing) * 1);
}

.history-skeleton__row {
  display: flex;
  gap: calc(var(--spacing) * 2.5);
  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 1.5);
}

.history-skeleton__lines {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 7px;
}

.history-detail {
  overflow-y: auto;
}

.history-detail__section {
  padding: calc(var(--spacing) * 5) calc(var(--spacing) * 7);
}

.history-detail__section--head {
  padding-top: calc(var(--spacing) * 6);
}

.history-detail__section + .history-detail__section {
  border-top: 1px solid var(--color-divider);
}

.is-narrow .history-detail__section {
  padding: calc(var(--spacing) * 4);
}

.history-detail__empty {
  flex: 1;
  justify-content: center;
}

.history-detail__skeleton {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3.5);
  padding: calc(var(--spacing) * 7);
}

.history-detail__skeleton-row {
  display: flex;
  gap: calc(var(--spacing) * 3);
}
</style>
