/**
 * useDrawerExecutions — the execution the side menu says is loaded, the DAG's latest ones to
 * switch to, and loading one of them.
 *
 * The loaded execution is the selected one (the tab picked in the bottom bar). Picking another
 * from the latest loads it if it is not loaded yet, selects it and picks its tab, as "Load" does
 * in the history.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import { useExecutionStatus } from '@cornflow-ui/core/composables/project-execution/useExecutionStatus'
import { showSnackbar } from '@cornflow-ui/core/services/SnackbarService'
import type { CoreTone } from '@cornflow-ui/core/types/ui'

/** How many of the latest executions the menu offers. */
export const RECENT_EXECUTIONS = 5

export interface DrawerExecution {
  id: string
  name: string
  /** "26 oct · 10:42" */
  date: string
  status: { label: string; tone: CoreTone; spin: boolean }
}

const SUCCESS_STATE = 1

export function useDrawerExecutions() {
  const store = useGeneralStore()
  const { t, locale } = useI18n()
  const { executionStatus, solutionStatus } = useExecutionStatus()

  const recent = ref<any[]>([])
  const loadingRecent = ref(false)
  const opening = ref<string | null>(null)

  function formatDate(value: unknown): string {
    const when = value instanceof Date ? value : new Date(String(value ?? ''))
    if (Number.isNaN(when.getTime())) return ''
    const day = new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }).format(when)
    const time = new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit' }).format(when)
    return `${day} · ${time}`
  }

  /** A finished execution reads as its solution ("Optimal"); any other, as its own state. */
  function statusOf(state: number | null | undefined, solutionCode: number | null | undefined) {
    const display =
      state === SUCCESS_STATE && solutionCode !== null && solutionCode !== undefined
        ? solutionStatus(solutionCode)
        : executionStatus(state)
    return { label: display.label, tone: display.tone, spin: display.spin }
  }

  function toDrawerExecution(execution: any, id: string): DrawerExecution {
    return {
      id,
      name: execution.name || id,
      date: formatDate(execution.createdAt),
      status: statusOf(execution.state, execution.solution_state?.status_code),
    }
  }

  const latest = computed<DrawerExecution[]>(() =>
    recent.value.slice(0, RECENT_EXECUTIONS).map((e) => toDrawerExecution(e, e.id)),
  )

  /** The selected execution; its solution state comes from the latest list when it is there. */
  const loaded = computed<DrawerExecution | null>(() => {
    const selected = store.selectedExecution
    if (!selected) return null
    const listed = recent.value.find((e) => e.id === selected.executionId)
    return toDrawerExecution(
      { ...selected, solution_state: listed?.solution_state },
      selected.executionId,
    )
  })

  async function refresh() {
    loadingRecent.value = true
    try {
      recent.value = await store.fetchRecentExecutions()
    } finally {
      loadingRecent.value = false
    }
  }

  /** Loads the execution if needed and makes it the selected one; resolves whether it worked. */
  async function open(execution: DrawerExecution): Promise<boolean> {
    if (store.selectedExecution?.executionId === execution.id) return true
    opening.value = execution.id
    try {
      const isLoaded = store.loadedExecutions.some((e: any) => e.executionId === execution.id)
      if (!isLoaded && !(await store.fetchLoadedExecution(execution.id))) {
        showSnackbar(t('projectExecution.snackbar.errorLoad'), 'error')
        return false
      }
      store.setSelectedExecution(execution.id)
      store.incrementTabBarKey()
      return true
    } catch {
      showSnackbar(t('projectExecution.snackbar.errorLoad'), 'error')
      return false
    } finally {
      opening.value = null
    }
  }

  return { loaded, latest, loadingRecent, opening, refresh, open }
}
