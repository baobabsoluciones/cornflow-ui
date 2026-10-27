/**
 * useExecutionHistoryFilters.ts — The executions history filters that work on the list already
 * loaded: the search box and the filters the user adds (execution state, solution state, user,
 * solver and, with replanning, origin). The plant-like filters (`executionFilters`) and the date
 * go to the backend instead.
 */
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { getAppParameters } from '@cornflow-ui/core/utils/appParameters'
import { useExecutionState } from '@cornflow-ui/core/composables/project-execution-table/useExecutionState'

/** One execution row of the history, as the executions list gives it. */
export type HistoryRow = Record<string, any>

export interface HistoryFilterDefinition {
  key: string
  /** i18n key of the filter name. */
  labelKey: string
  icon: string
  /** Group of the "Add filter" menu. */
  group: 'execution' | 'solution'
  /** Value of a row for this filter, as text; `null` when the row has none. */
  valueOf: (row: HistoryRow) => string | null
  /** Text shown for a value. */
  titleOf: (value: string) => string
}

export interface HistoryFilterOption {
  value: string
  title: string
  /** Rows the option leaves, given the search and the other filters. */
  count: number
}

export function useExecutionHistoryFilters() {
  const { t } = useI18n()
  const { getStateInfo, getSolutionInfo } = useExecutionState()

  const state = reactive({
    search: '',
    /** Filters the user added, in the order they were added. */
    added: [] as string[],
    /** Picked value per added filter; `null` is "All". */
    picked: {} as Record<string, string | null>,
  })

  const definitions = computed<HistoryFilterDefinition[]>(() => [
    {
      key: 'state',
      labelKey: 'versionHistory.filterBar.fields.state',
      icon: 'mdi-progress-check',
      group: 'execution',
      valueOf: (row) => (row.state == null ? null : String(row.state)),
      titleOf: (value) => getStateInfo(Number(value)).code,
    },
    {
      key: 'user',
      labelKey: 'versionHistory.filterBar.fields.user',
      icon: 'mdi-account-outline',
      group: 'execution',
      valueOf: (row) => row.userFullName || row.userName || null,
      titleOf: (value) => value,
    },
    ...(getAppParameters().enableRecalculationOnMasterEdit
      ? [
          {
            key: 'origin',
            labelKey: 'versionHistory.filterBar.fields.origin',
            icon: 'mdi-source-branch',
            group: 'execution' as const,
            valueOf: (row: HistoryRow) =>
              row.config?.replanning === true ? 'replanning' : 'model',
            titleOf: (value: string) =>
              t(`versionHistory.filterBar.origin.${value}`),
          },
        ]
      : []),
    {
      key: 'solutionState',
      labelKey: 'versionHistory.filterBar.fields.solutionState',
      icon: 'mdi-check-decagram-outline',
      group: 'solution',
      valueOf: (row) =>
        row.solution_state?.status_code == null
          ? null
          : String(row.solution_state.status_code),
      titleOf: (value) => getSolutionInfo({ status_code: Number(value) }).code,
    },
    {
      key: 'solver',
      labelKey: 'versionHistory.filterBar.fields.solver',
      icon: 'mdi-cpu-64-bit',
      group: 'solution',
      valueOf: (row) => row.config?.solver ?? null,
      titleOf: (value) => value,
    },
  ])

  const definitionOf = (key: string) =>
    definitions.value.find((definition) => definition.key === key)

  const matchesSearch = (row: HistoryRow): boolean => {
    const text = state.search.trim().toLowerCase()
    if (!text) return true
    return [row.name, row.description].some((value) =>
      String(value ?? '')
        .toLowerCase()
        .includes(text),
    )
  }

  /** The row passes the search and every added filter, leaving out `exceptKey`. */
  const matches = (row: HistoryRow, exceptKey?: string): boolean =>
    matchesSearch(row) &&
    state.added.every((key) => {
      const picked = state.picked[key]
      if (key === exceptKey || picked == null) return true
      return definitionOf(key)?.valueOf(row) === picked
    })

  function filterRows<T extends HistoryRow>(rows: T[]): T[] {
    return rows.filter((row) => matches(row))
  }

  /** The values of a filter found in `rows`, each with the rows it would leave. */
  function optionsOf(key: string, rows: HistoryRow[]): HistoryFilterOption[] {
    const definition = definitionOf(key)
    if (!definition) return []
    const counts = new Map<string, number>()
    for (const row of rows) {
      const value = definition.valueOf(row)
      if (value == null) continue
      counts.set(value, (counts.get(value) ?? 0) + (matches(row, key) ? 1 : 0))
    }
    const picked = state.picked[key]
    if (picked != null && !counts.has(picked)) counts.set(picked, 0)
    return [...counts]
      .map(([value, count]) => ({
        value,
        title: definition.titleOf(value),
        count,
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
  }

  const addedDefinitions = computed(() =>
    state.added
      .map(definitionOf)
      .filter(
        (definition): definition is HistoryFilterDefinition => !!definition,
      ),
  )

  const availableDefinitions = computed(() =>
    definitions.value.filter(
      (definition) => !state.added.includes(definition.key),
    ),
  )

  function add(key: string) {
    if (!definitionOf(key) || state.added.includes(key)) return
    state.added = [...state.added, key]
    state.picked = { ...state.picked, [key]: null }
  }

  function remove(key: string) {
    state.added = state.added.filter((added) => added !== key)
    const { [key]: _removed, ...rest } = state.picked
    state.picked = rest
  }

  function pick(key: string, value: string | null) {
    if (!state.added.includes(key)) return
    state.picked = { ...state.picked, [key]: value }
  }

  function clear() {
    state.search = ''
    state.added = []
    state.picked = {}
  }

  /** True when the search or an added filter is in use. */
  const isActive = computed(
    () => state.search.trim() !== '' || state.added.length > 0,
  )

  return reactive({
    state,
    definitions,
    addedDefinitions,
    availableDefinitions,
    filterRows,
    optionsOf,
    add,
    remove,
    pick,
    clear,
    isActive,
  })
}
