<template>
  <div
    ref="root"
    class="view-container history-execution-view"
    :class="{ 'is-narrow': narrow }"
  >
    <CoreTitleView
      icon="mdi-history"
      :title="$t('versionHistory.title')"
      :description="narrow && selectedExecution ? '' : $t('versionHistory.description')"
      class="history-title"
    >
      <template #actions>
        <CoreButton
          variant="outlined"
          icon="mdi-plus"
          :text="$t('versionHistory.createNewExecution')"
          data-testid="history-create-execution"
          data-tour="history-new-execution"
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
        <div class="history-filters" data-tour="history-filters">
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
              @pick="historyFilters.pick(definition.key, $event as string | null)"
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

        <div class="history-list__scroll" data-tour="history-list">
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
            :message="$t('versionHistory.list.emptyText')"
          />
          <CoreEmptyState
            v-else-if="filteredData.length === 0"
            class="history-empty"
            icon="mdi-filter-remove-outline"
            :title="$t('versionHistory.list.noResultsTitle')"
            :message="$t('versionHistory.list.noResultsText')"
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
        data-tour="history-detail"
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
          :message="$t('versionHistory.detail.noSelectionText')"
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
      tone="danger"
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

<script setup lang="ts">
import {
  computed,
  inject,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  reactive,
  ref,
  useTemplateRef,
  watch,
} from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
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
import DateFilterChip, {
  type DatePreset,
} from '@cornflow-ui/core/components/core/filters/DateFilterChip.vue'
import AddFilterMenu from '@cornflow-ui/core/components/core/filters/AddFilterMenu.vue'
import ExecutionDetailHeader from '@cornflow-ui/core/components/project-execution/ExecutionDetailHeader.vue'
import ExecutionList, {
  type ExecutionDay,
} from '@cornflow-ui/core/components/project-execution/ExecutionList.vue'
import { useExecutionHistoryFilters } from '@cornflow-ui/core/composables/project-execution/useExecutionHistoryFilters'
import {
  useExecutionDetails,
  type HistoryExecution,
} from '@cornflow-ui/core/composables/project-execution/useExecutionDetails'
import { isExecutionActive } from '@cornflow-ui/core/utils/executionStates'
import { useLatestPlanController } from '@cornflow-ui/core/composables/project-execution/useLatestPlanController'
import { EXECUTIONS_LIST_LIMIT } from '@cornflow-ui/core/repositories/ExecutionRepository'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import type { ExecutionFilter } from '@cornflow-ui/core/types/executionFilters'
import {
  formatLocalDateKey,
  formatLocalTimeHHmm,
  parseLocalDateKey,
} from '@cornflow-ui/core/utils/date'

defineOptions({ name: 'HistoryExecutionView' })

type DateOption = 'today' | 'yesterday' | 'last7days' | 'lastMonth' | 'custom'

interface DateRange {
  startDate: Date | null
  endDate: Date | null
}

/** The days of a custom range, as `YYYY-MM-DD`. */
interface CustomDates {
  startDate: string | null
  endDate: string | null
}

/** An execution of the list, with the time it was created at (`HH:mm`, local). */
type HistoryRow = HistoryExecution & { time: string }

/** The executions created on one day (`YYYY-MM-DD`, local). */
interface HistoryDay {
  date: string
  data: HistoryRow[]
}

/** Date range the history opens with. */
const DEFAULT_DATE_OPTION: DateOption = 'lastMonth'

const DATE_OPTIONS: DateOption[] = ['today', 'yesterday', 'last7days', 'lastMonth', 'custom']

/**
 * The days a date option lists: today, yesterday, the last 7 days or the last month up to today;
 * a custom range once both its days are given. No option, or a custom range not complete, has
 * no days.
 */
function datesOfOption(option: DateOption | null, custom: CustomDates, today = new Date()): DateRange {
  const daysAgo = (days: number) => {
    const date = new Date(today)
    date.setDate(date.getDate() - days)
    return date
  }
  switch (option) {
    case 'today':
      return { startDate: today, endDate: today }
    case 'yesterday':
      return { startDate: daysAgo(1), endDate: daysAgo(1) }
    case 'last7days':
      return { startDate: daysAgo(7), endDate: today }
    case 'lastMonth': {
      const monthAgo = new Date(today)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return { startDate: monthAgo, endDate: today }
    }
    case 'custom':
      return custom.startDate && custom.endDate
        ? { startDate: parseLocalDateKey(custom.startDate), endDate: parseLocalDateKey(custom.endDate) }
        : { startDate: null, endDate: null }
    default:
      return { startDate: null, endDate: null }
  }
}

/** Below this width (px) the list and the detail take turns instead of sitting side by side. */
const NARROW_WIDTH = 860

const { t, te, locale } = useI18n()
const router = useRouter()
const generalStore = useGeneralStore()
const historyFilters = useExecutionHistoryFilters()
const executionDetails = useExecutionDetails()
// latest-plan controller injected by the premium module; inert when the module is absent.
const latestPlan = useLatestPlanController()
const showSnackbar = inject<(message: string, type?: string) => void>('showSnackbar')!

const root = useTemplateRef<HTMLElement>('root')

const data = ref<HistoryDay[]>([])
const dateOptionSelected = ref<DateOption | null>(null)
const customSelectedDates = reactive<CustomDates>({ startDate: null, endDate: null })
const loadingExecutions = reactive(new Set<string>())
const deletingExecutions = reactive(new Set<string>())
const downloadingExecutions = reactive(new Set<string>())
// Start `true` so the skeleton is visible from the very first paint, before `onActivated` fires
// `fetchData`. Avoids the flash where "no executions" briefly renders for users who just logged in.
const loadingData = ref(true)
// Filter added last, whose menu opens as it appears.
const justAddedFilter = ref<string | null>(null)
const listLimit = EXECUTIONS_LIST_LIMIT
const selectedExecutionId = ref<string | null>(null)
const executionToDelete = ref<HistoryRow | null>(null)
const latestPlanCandidate = ref<{ id: string; name: string } | null>(null)
const showLatestPlanModal = ref(false)
const narrow = ref(false)
// Current time, ticking while the view is shown, for the live durations of running executions.
const now = ref(Date.now())

// Coalesce overlapping list fetches (see `fetchData`).
let fetchInFlight = false
let fetchQueued = false
// Pending id of the fetchData retry timer, cleared on unmount/deactivate so a late retry can't
// run on a torn-down component.
let fetchRetryTimer: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null

/** The days the list is loaded for. */
const selectedDates = computed(() => datesOfOption(dateOptionSelected.value, customSelectedDates))
/** The days as text, so the list loads again only when they change. */
const selectedDaysKey = computed(() => {
  const { startDate, endDate } = selectedDates.value
  return `${startDate?.toDateString() ?? ''}|${endDate?.toDateString() ?? ''}`
})
const datePresets = computed<DatePreset[]>(() =>
  DATE_OPTIONS.map((value) => ({ value, label: t(`versionHistory.${value}`) })),
)
/** Executions history filters with options (none without their frontend-automation table). */
const visibleFilters = computed(() =>
  generalStore.getExecutionFilters.filter((filter) => filterOptions(filter).length > 0),
)
/** Picked filters as one value, so a change lists the executions again. */
const filterParamsSignature = computed(() => JSON.stringify(generalStore.getExecutionFilterParams))
/** Every loaded execution, across days. */
const rows = computed(() => data.value.flatMap((group) => group.data))
/** The days with the executions that pass the search and the added filters. */
const filteredData = computed(() =>
  data.value
    .map((group) => ({ ...group, data: historyFilters.filterRows(group.data) }))
    .filter((group) => group.data.length > 0),
)
/** The filtered days, newest first, as the list shows them. */
const executionDays = computed<ExecutionDay[]>(() =>
  filteredData.value
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((group) => ({
      key: group.date,
      label: dayTitle(group.date),
      executions: group.data
        .slice()
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    })),
)
const executionCount = computed(() =>
  filteredData.value.reduce((total, group) => total + group.data.length, 0),
)
/** The list came back full: older executions in the range are not loaded. */
const limitReached = computed(
  () => Boolean(selectedDates.value.startDate) && rows.value.length >= EXECUTIONS_LIST_LIMIT,
)
/** The range is wider than a week, so narrowing to the last 7 days lists fewer executions. */
const canNarrowToLastWeek = computed(() =>
  dateOptionSelected.value === 'lastMonth' || dateOptionSelected.value === 'custom',
)
/** Filters the user can still add, by group. */
const addFilterGroups = computed(() =>
  ['execution', 'solution']
    .map((group) => ({
      key: group,
      title: t(`versionHistory.filterBar.groups.${group}`),
      fields: historyFilters.availableDefinitions
        .filter((definition) => definition.group === group)
        .map((definition) => ({
          key: definition.key,
          title: t(definition.labelKey),
          icon: definition.icon,
        })),
    }))
    .filter((group) => group.fields.length > 0),
)
/** Anything away from how the history opens: search, filters or another date range. */
const anyFilterActive = computed(
  () =>
    historyFilters.isActive ||
    dateOptionSelected.value !== DEFAULT_DATE_OPTION ||
    Object.keys(generalStore.getExecutionFilterParams).length > 0,
)
const selectedExecution = computed(
  () => rows.value.find((execution) => execution.id === selectedExecutionId.value) ?? null,
)
const selectedParameters = computed(() =>
  selectedExecution.value ? executionDetails.parameterItems(selectedExecution.value) : [],
)
/** On a narrow screen the detail replaces the list while an execution is selected. */
const showList = computed(() => !narrow.value || !selectedExecution.value)
const showDetail = computed(() => !narrow.value || Boolean(selectedExecution.value))
/**
 * Signature of the store's tracked executions (id + state). Changes only when an execution
 * transitions state (the background poller updates `loadedExecutions` on transition), which is
 * exactly when the history needs to refresh its states.
 */
const loadedExecutionsSignature = computed(() =>
  generalStore.loadedExecutions
    .map((execution) => `${execution.executionId}:${execution.state}`)
    .join('|'),
)

// Keep the history rows in sync with the live execution state held in the store. Without this, a
// row launched while the user is on this view stays stuck on "Loading" forever: the list is a
// one-shot snapshot from `fetchData`, while the actual completion is detected by the store poller.
watch(loadedExecutionsSignature, () => syncExecutionStatesFromStore())
watch(filterParamsSignature, () => fetchData())
// Another option drops the custom days; no option shows nothing.
watch(dateOptionSelected, (option, previous) => {
  customSelectedDates.startDate = null
  customSelectedDates.endDate = null
  if (!option) data.value = []
  // Leaving a custom range that had no days keeps the same (empty) days: load again anyway.
  if (previous === 'custom' && !selectedDates.value.startDate) fetchData()
})
// A custom range loads once both its days are given.
watch(selectedDaysKey, () => {
  if (dateOptionSelected.value === 'custom' && !selectedDates.value.startDate) return
  fetchData()
})
// On a wide screen the detail always shows an execution: the newest one, until the user picks.
watch(executionDays, () => selectFirstExecutionIfNone())
watch(narrow, () => selectFirstExecutionIfNone())

onMounted(() => {
  dateOptionSelected.value = DEFAULT_DATE_OPTION
  observeWidth()
  executionDetails.loadParameterOptions()
})
onActivated(() => {
  fetchData()
  // Make sure the background poller is running so rows that are still loading flip to their
  // final state while the user watches the history — even if the list request itself is
  // failing. `loadedExecutionsSignature` then syncs those state changes into the list.
  generalStore.autoLoadExecutions()
  startClock()
})
onDeactivated(() => {
  clearFetchRetryTimer()
  stopClock()
})
onBeforeUnmount(() => {
  clearFetchRetryTimer()
  stopClock()
  resizeObserver?.disconnect()
})

function filterOptions(filter: ExecutionFilter) {
  return generalStore.executionFilterOptions[filter.key] ?? []
}

function filterLabel(filter: ExecutionFilter) {
  return te(filter.labelKey) ? t(filter.labelKey) : filter.labelKey
}

function pickFilterValue(filter: ExecutionFilter, value: unknown) {
  generalStore.setExecutionFilterValue(filter.key, value)
}

function addHistoryFilter(key: string) {
  historyFilters.add(key)
  justAddedFilter.value = key
}

/** Back to how the history opens: no search, no filters, the default date range. */
function clearFilters() {
  historyFilters.clear()
  justAddedFilter.value = null
  for (const key of Object.keys(generalStore.getExecutionFilterParams)) {
    generalStore.setExecutionFilterValue(key, null)
  }
  dateOptionSelected.value = DEFAULT_DATE_OPTION
}

/** "Today · 21 Oct", "Yesterday · 20 Oct", "Monday · 19 Oct" (with the year when not this one). */
function dayTitle(date: string) {
  const day = parseLocalDateKey(date)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const name = sameDay(day, today)
    ? t('versionHistory.today')
    : sameDay(day, yesterday)
      ? t('versionHistory.yesterday')
      : day.toLocaleDateString(locale.value, { weekday: 'long' })
  const short = day.toLocaleDateString(locale.value, {
    day: 'numeric',
    month: 'short',
    ...(day.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  })
  return `${name} · ${short}`
}

function navigateToCreateExecution() {
  router.push('/project-execution')
}

function selectExecution(id: string) {
  selectedExecutionId.value = id
}

function selectFirstExecutionIfNone() {
  if (narrow.value || selectedExecution.value) return
  selectedExecutionId.value = executionDays.value[0]?.executions[0]?.id ?? null
}

/** Watches the view's width: below `NARROW_WIDTH` the list and the detail take turns. */
function observeWidth() {
  if (!root.value || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width ?? 0
    // A width of 0 is a view not laid out yet (or a test): keep the wide layout.
    narrow.value = width > 0 && width < NARROW_WIDTH
  })
  resizeObserver.observe(root.value)
}

function startClock() {
  stopClock()
  now.value = Date.now()
  clockTimer = setInterval(() => {
    if (rows.value.some((execution) => isExecutionActive(execution.state))) {
      now.value = Date.now()
    }
  }, 1000)
}

function stopClock() {
  if (clockTimer) {
    clearInterval(clockTimer)
    clockTimer = null
  }
}

function isLatestPlan(id: string) {
  return latestPlan.isLatestPlan(id)
}

function canSetCurrentPlan(execution: HistoryExecution) {
  return (
    latestPlan.isSetLatestPlanAvailable() &&
    latestPlan.canSetAsLatestPlan(execution.state) &&
    !latestPlan.isLatestPlan(execution.id)
  )
}

function openSetLatestPlan(execution: HistoryExecution) {
  latestPlanCandidate.value = {
    id: execution.id,
    name: execution.name || `Execution ${execution.id}`,
  }
  showLatestPlanModal.value = true
}

function handleLatestPlanSuccess() {
  showSnackbar(t('latestPlan.snackbar.success'), 'success')
}

function handleLatestPlanError(message?: string) {
  showSnackbar(message || t('latestPlan.snackbar.error'), 'error')
}

function clearFetchRetryTimer() {
  if (fetchRetryTimer) {
    clearTimeout(fetchRetryTimer)
    fetchRetryTimer = null
  }
}

async function fetchData(attempt = 0): Promise<void> {
  // Coalesce overlapping fetches. A single user action (picking a date option, typing custom
  // dates) can fire several watchers, and each list query can be slow/heavy on the backend. Keep
  // at most one request in flight plus one trailing refetch (with the latest dates) so we don't
  // pile duplicate queries onto a backend that is already struggling while an execution is
  // running.
  if (attempt === 0) {
    if (fetchInFlight) {
      fetchQueued = true
      return
    }
    fetchInFlight = true
    // Show the "loading" state (not the previous rows) until the new data actually arrives.
    data.value = []
  }
  loadingData.value = true
  try {
    const result = await generalStore.fetchExecutionsByDateRange(
      selectedDates.value.startDate,
      selectedDates.value.endDate,
    )

    if (result) {
      showSnackbar(t('projectExecution.snackbar.succesSearch'))
      data.value = formatData(result)
      // Overlay the freshest known state from the store so rows reflect any execution that has
      // already finished/transitioned since the list was built on the backend.
      syncExecutionStatesFromStore()
      return
    }

    // `result === undefined` only happens when the store swallowed an exception (see
    // `fetchExecutionsByDateRange` in stores/general.ts). The most common cause right after login
    // is a token-signature race: this view's `onActivated` hook fires before the auth token has
    // been written to sessionStorage, so the API rejects the request. Retry once after a short
    // delay before surfacing "no data" — by then the token should be in place and the call
    // succeeds transparently.
    if (attempt === 0) {
      await new Promise((resolve) => {
        fetchRetryTimer = setTimeout(resolve, 600)
      })
      fetchRetryTimer = null
      return await fetchData(1)
    }

    data.value = formatData([])
    showSnackbar(t('projectExecution.snackbar.noDataSearch'))
  } catch {
    data.value = formatData([])
    showSnackbar(t('projectExecution.snackbar.errorSearch'), 'error')
  } finally {
    loadingData.value = false
    if (attempt === 0) {
      fetchInFlight = false
      // If a fetch was requested while this one ran, run it once now with whatever the current
      // dates are.
      if (fetchQueued) {
        fetchQueued = false
        fetchData()
      }
    }
  }
}

/**
 * Updates the state of the displayed rows from the store's tracked executions. The background
 * poller keeps `loadedExecutions` current, so a row that was "Loading" when fetched flips to its
 * final state here without needing another (possibly queued/stalled) list request.
 */
function syncExecutionStatesFromStore() {
  const stateById = new Map<string, number>(
    generalStore.loadedExecutions.map((execution) => [execution.executionId, execution.state]),
  )
  applyExecutionStates(stateById)
}

/**
 * Applies a map of executionId -> state onto the displayed rows. Reassigns `data` with fresh
 * references only when something actually changed, so the list re-renders the states (and we
 * avoid needless churn).
 */
function applyExecutionStates(stateById: Map<string, number>) {
  let changed = false
  const next = data.value.map((group) => ({
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
    data.value = next
  }
}

/** The executions grouped by the user's local day, each with its local time. */
function formatData(rawData: HistoryExecution[]): HistoryDay[] {
  const days: Record<string, HistoryDay> = {}
  for (const item of rawData) {
    if (!item.createdAt || typeof item.createdAt !== 'string') continue
    // Group by the user's local day (createdAt is already normalised to UTC by the repository),
    // so executions launched around midnight land on the day the user actually launched them.
    const date = formatLocalDateKey(item.createdAt)
    if (!date) continue
    days[date] ??= { date, data: [] }
    days[date].data.push({ time: formatLocalTimeHHmm(item.createdAt), ...item })
  }
  return Object.values(days)
}

async function loadExecution(execution: HistoryExecution) {
  loadingExecutions.add(execution.id)
  try {
    const loadedResult = await generalStore.fetchLoadedExecution(execution.id)

    if (loadedResult) {
      generalStore.setSelectedExecution(execution.id)
      showSnackbar(t('projectExecution.snackbar.successLoad'))
    } else {
      showSnackbar(t('projectExecution.snackbar.errorLoad'), 'error')
    }
  } catch {
    showSnackbar(t('projectExecution.snackbar.errorLoad'), 'error')
  } finally {
    loadingExecutions.delete(execution.id)
  }
}

async function downloadExcel(execution: HistoryExecution) {
  downloadingExecutions.add(execution.id)
  try {
    await generalStore.getDataToDownload(execution.id, true, true)
  } catch {
    showSnackbar(t('inputOutputData.errorDownloadingExcel'), 'error')
  } finally {
    downloadingExecutions.delete(execution.id)
  }
}

function askDelete(execution: HistoryRow) {
  executionToDelete.value = execution
}

async function confirmDelete() {
  const execution = executionToDelete.value
  if (!execution) return
  await deleteExecution(execution)
  executionToDelete.value = null
}

async function deleteExecution(execution: HistoryExecution) {
  // Mark the execution as deleting so its action shows a spinner while the (sometimes slow)
  // DELETE + refetch is in flight.
  deletingExecutions.add(execution.id)
  try {
    const result = await generalStore.deleteExecution(execution.id)

    if (result) {
      if (selectedExecutionId.value === execution.id) {
        selectedExecutionId.value = null
      }
      await fetchData()
      showSnackbar(t('projectExecution.snackbar.successDelete'))
    } else {
      showSnackbar(t('projectExecution.snackbar.errorDelete'), 'error')
    }
  } catch {
    showSnackbar(t('projectExecution.snackbar.errorDelete'), 'error')
  } finally {
    deletingExecutions.delete(execution.id)
  }
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
  grid-template-columns: minmax(0, 1fr) minmax(440px, 1fr);
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
