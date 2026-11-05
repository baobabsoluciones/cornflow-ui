/**
 * What the summary of the loaded execution says (`ExecutionSummary`): under its name, the date it
 * was created and its solver; beside it, its state as the execution tab bar shows it. An app
 * changes either through `parameters.executionSummary` of its config (`ExecutionSummaryResolver`).
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import { useExecutionStatus } from '@cornflow-ui/core/composables/project-execution/useExecutionStatus'
import { useExecutionDetails } from '@cornflow-ui/core/composables/project-execution/useExecutionDetails'
import type { LoadedExecution } from '@cornflow-ui/core/models/LoadedExecution'
import type {
  ExecutionSummaryContent,
  ExecutionSummaryResolver,
} from '@cornflow-ui/core/types/executionSummary'

export function useExecutionSummary(
  execution: MaybeRefOrGetter<LoadedExecution | null | undefined>,
) {
  const store = useGeneralStore()
  const { displayStatus } = useExecutionStatus()
  const { formatDateTime } = useExecutionDetails()

  function defaults(loaded: LoadedExecution): ExecutionSummaryContent {
    const showSolver =
      store.appConfig?.parameters?.showExtraProjectExecutionColumns?.showSolver !== false
    const status = displayStatus(loaded.state, loaded.solutionState?.status_code)
    return {
      meta: [
        loaded.createdAt ? formatDateTime(loaded.createdAt) : '',
        showSolver ? loaded.config?.solver : '',
      ]
        .filter(Boolean)
        .join(' · '),
      badges: [
        { label: status.label, tone: status.tone, title: status.message, spin: status.spin },
      ],
    }
  }

  return computed<ExecutionSummaryContent | null>(() => {
    const loaded = toValue(execution)
    if (!loaded) return null
    const base = defaults(loaded)
    const resolve = store.appConfig?.parameters?.executionSummary as
      | ExecutionSummaryResolver
      | null
      | undefined
    return typeof resolve === 'function' ? { ...base, ...resolve(loaded, base) } : base
  })
}
