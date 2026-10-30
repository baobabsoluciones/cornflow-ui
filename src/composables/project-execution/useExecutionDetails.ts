/**
 * What the history shows about one execution: its data (user, dates, duration, solver, time
 * limit), the parameters it was launched with (`configFields`), and the steps of its progress.
 *
 * The data rows follow `showExtraProjectExecutionColumns` of the app config, as the history list
 * did with its columns: user name or full name, finish time, solver and time limit appear only
 * where the app shows them.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import {
  QUEUED_STATE,
  RUNNING_STATE,
  useExecutionStatus,
} from '@cornflow-ui/core/composables/project-execution/useExecutionStatus'
import { formatLocalTimeHHmm } from '@cornflow-ui/core/utils/date'
import type { DescriptionItem } from '@cornflow-ui/core/components/core/CoreDescriptionList.vue'
import type { TimelineStep } from '@cornflow-ui/core/components/core/CoreTimeline.vue'

/** The fields of a history row this composable reads. */
export interface HistoryExecution {
  id: string
  name: string
  description?: string
  state: number
  message?: string
  createdAt: string
  finishedAt?: string | null
  userName?: string | null
  userFullName?: string | null
  config?: Record<string, unknown> & {
    solver?: string
    timeLimit?: number | string
  }
  solution_state?: { status_code?: number | null } | null
}

interface ConfigField {
  key: string
  title?: string
  type?: string
  suffix?: string
  options?: { value: unknown; label: string }[]
  joinFrom?: string
}

/** The `timeLimit` config field says `minutes: true` (as the parameters step reads it). */
export function isConfigTimeLimitInMinutes(
  configFields: Array<{ key?: string; minutes?: boolean }> | undefined,
): boolean {
  const field = configFields?.find(
    (candidate) => String(candidate?.key ?? '').toLowerCase() === 'timelimit',
  )
  return field?.minutes === true
}

/** i18n key of the unit of the time limit. */
export function getTimeLimitUnitI18nKey(
  configFields: Array<{ key?: string; minutes?: boolean }> | undefined,
): string {
  return isConfigTimeLimitInMinutes(configFields)
    ? 'configParams.minutesSuffix'
    : 'configParams.secondsSuffix'
}

const pad = (value: number): string => String(value).padStart(2, '0')

/** "42 s", "12 min 04 s", "1 h 05 min". */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  if (seconds < 60) return `${seconds} s`
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)} min ${pad(seconds % 60)} s`
  return `${Math.floor(seconds / 3600)} h ${pad(Math.floor((seconds % 3600) / 60))} min`
}

const toMs = (value: string | null | undefined): number | null => {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

export function useExecutionDetails() {
  const { t, te, locale } = useI18n()
  const generalStore = useGeneralStore()
  const { executionStatus } = useExecutionStatus()

  const parameters = computed(() => generalStore.appConfig.parameters)
  const extraColumns = computed<{
    showUserName?: boolean
    showUserFullName?: boolean
    showEndCreationDate?: boolean
    showTimeLimit?: boolean
    showSolver?: boolean
  }>(() => parameters.value.showExtraProjectExecutionColumns ?? {})
  const configFields = computed<ConfigField[]>(
    () => parameters.value.configFields ?? [],
  )

  const translate = (key: string | undefined): string =>
    key && te(key) ? t(key) : (key ?? '')

  const formatDay = (value: string): string => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleDateString(locale.value, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatDateTime = (value: string): string =>
    toMs(value) === null
      ? '—'
      : `${formatDay(value)} · ${formatLocalTimeHHmm(value)}`

  /** Time limit of the execution in seconds (the config may declare it in minutes). */
  function timeLimitSeconds(execution: HistoryExecution): number | null {
    const raw = Number(execution.config?.timeLimit)
    if (!Number.isFinite(raw) || raw <= 0) return null
    return isConfigTimeLimitInMinutes(configFields.value) ? raw * 60 : raw
  }

  const showsTimeLimit = computed(
    () =>
      Boolean(extraColumns.value.showTimeLimit) &&
      Boolean(parameters.value.configFieldsConfig?.showConfigFieldsStep),
  )

  function dataItems(
    execution: HistoryExecution,
    now: number,
  ): DescriptionItem[] {
    const created = toMs(execution.createdAt)
    const finished = toMs(execution.finishedAt)
    const active =
      execution.state === RUNNING_STATE || execution.state === QUEUED_STATE
    const items: DescriptionItem[] = []

    if (
      extraColumns.value.showUserFullName ||
      extraColumns.value.showUserName
    ) {
      const user = extraColumns.value.showUserFullName
        ? execution.userFullName || execution.userName
        : execution.userName
      items.push({
        label: t('versionHistory.detail.user'),
        value: user || '—',
        muted: !user,
      })
    }
    items.push({
      label: t('versionHistory.detail.created'),
      value: formatDateTime(execution.createdAt),
    })
    if (extraColumns.value.showEndCreationDate) {
      items.push({
        label: t('versionHistory.detail.finished'),
        value:
          !active && execution.finishedAt
            ? formatDateTime(execution.finishedAt)
            : '—',
        muted: active || !execution.finishedAt,
      })
    }
    const end = active ? now : finished
    items.push({
      label: t('versionHistory.detail.duration'),
      value:
        created !== null && end !== null
          ? formatDuration((end - created) / 1000) +
            (active ? ` · ${t('versionHistory.detail.inProgress')}` : '')
          : '—',
      muted: created === null || end === null,
    })
    if (extraColumns.value.showSolver !== false) {
      items.push({
        label: t('versionHistory.detail.solver'),
        value: execution.config?.solver || '—',
      })
    }
    if (showsTimeLimit.value && execution.config?.timeLimit) {
      items.push({
        label: t('versionHistory.detail.timeLimit'),
        value: `${execution.config.timeLimit} ${t(getTimeLimitUnitI18nKey(configFields.value))}`,
      })
    }
    return items
  }

  /** Options of the parameters fed by a frontend-automation table, by `joinFrom`. */
  const tableOptions = ref<Record<string, { value: unknown; title: string }[]>>(
    {},
  )

  /** Loads the names of the parameters that store an id of a frontend-automation table. */
  async function loadParameterOptions(): Promise<void> {
    const sources = [
      ...new Set(
        configFields.value
          .map((field) => field.joinFrom)
          .filter((joinFrom): joinFrom is string => Boolean(joinFrom)),
      ),
    ].filter((joinFrom) => !(joinFrom in tableOptions.value))
    await Promise.all(
      sources.map(async (joinFrom) => {
        const options = await generalStore.fetchTableOptions(joinFrom)
        tableOptions.value = { ...tableOptions.value, [joinFrom]: options }
      }),
    )
  }

  function formatParameter(field: ConfigField, value: unknown): string {
    const same = (option: { value: unknown }) =>
      String(option.value) === String(value)
    if (field.joinFrom) {
      return (
        tableOptions.value[field.joinFrom]?.find(same)?.title ?? String(value)
      )
    }
    const option = field.options?.find(same)
    if (option) return translate(option.label)
    if (typeof value === 'boolean')
      return t(value ? 'versionHistory.detail.yes' : 'versionHistory.detail.no')
    if (field.type === 'date' && typeof value === 'string')
      return formatDay(value)
    const suffix = field.suffix ? ` ${translate(field.suffix)}` : ''
    return `${String(value)}${suffix}`
  }

  /** The parameters the execution was launched with, as the parameters step names them. */
  function parameterItems(execution: HistoryExecution): DescriptionItem[] {
    const config = execution.config ?? {}
    return configFields.value
      .filter((field) => field.key !== 'timeLimit')
      .filter(
        (field) =>
          config[field.key] !== undefined &&
          config[field.key] !== null &&
          config[field.key] !== '',
      )
      .map((field) => ({
        label: translate(field.title) || field.key,
        value: formatParameter(field, config[field.key]),
      }))
  }

  /** Queued → running → how it ended. The backend gives no start time, only creation and end. */
  function timelineSteps(
    execution: HistoryExecution,
    now: number,
  ): TimelineStep[] {
    const created = toMs(execution.createdAt)
    const finished = toMs(execution.finishedAt)
    const createdTime = formatLocalTimeHHmm(execution.createdAt)
    const state = execution.state
    const status = executionStatus(state)

    if (state === QUEUED_STATE) {
      return [
        {
          key: 'queued',
          label: t('versionHistory.timeline.queued'),
          time: createdTime,
          description:
            created !== null
              ? t('versionHistory.timeline.waiting', {
                  time: formatDuration((now - created) / 1000),
                })
              : undefined,
          status: 'current',
          tone: status.tone,
          icon: status.icon,
        },
        {
          key: 'run',
          label: t('versionHistory.timeline.running'),
          description: t('versionHistory.timeline.pending'),
          status: 'pending',
        },
        {
          key: 'end',
          label: t('versionHistory.timeline.finished'),
          description: t('versionHistory.timeline.pending'),
          status: 'pending',
        },
      ]
    }

    const queued: TimelineStep = {
      key: 'queued',
      label: t('versionHistory.timeline.queued'),
      time: createdTime,
      description: t('versionHistory.timeline.created'),
      status: 'done',
    }

    if (state === RUNNING_STATE) {
      const elapsed = created !== null ? (now - created) / 1000 : 0
      const limit = timeLimitSeconds(execution)
      return [
        queued,
        {
          key: 'run',
          label: t('versionHistory.timeline.running'),
          description: limit
            ? t('versionHistory.timeline.elapsedOf', {
                elapsed: formatDuration(elapsed),
                limit: formatDuration(limit),
              })
            : formatDuration(elapsed),
          status: 'current',
          tone: status.tone,
          icon: status.icon,
          spin: status.spin,
          progress: limit ? (elapsed / limit) * 100 : null,
          progressLabel: t('versionHistory.timeline.limitUsed'),
        },
        {
          key: 'end',
          label: t('versionHistory.timeline.finished'),
          description: t('versionHistory.timeline.pending'),
          status: 'pending',
        },
      ]
    }

    const run: TimelineStep =
      state === -3
        ? {
            key: 'run',
            label: t('versionHistory.timeline.execution'),
            description: t('versionHistory.timeline.notStarted'),
            status: 'failed',
            tone: status.tone,
            icon: status.icon,
          }
        : state === -4 || state === 2
          ? {
              key: 'run',
              label: t('versionHistory.timeline.execution'),
              description: status.message,
              status: 'skipped',
            }
          : {
              key: 'run',
              label: t('versionHistory.timeline.execution'),
              description:
                created !== null && finished !== null
                  ? t('versionHistory.timeline.took', {
                      time: formatDuration((finished - created) / 1000),
                    })
                  : undefined,
              status: 'done',
            }

    return [
      queued,
      run,
      {
        key: 'end',
        label: status.label,
        time: execution.finishedAt
          ? formatLocalTimeHHmm(execution.finishedAt)
          : undefined,
        description: status.message,
        status: 'current',
        tone: status.tone,
        icon: status.icon,
      },
    ]
  }

  return {
    dataItems,
    parameterItems,
    timelineSteps,
    loadParameterOptions,
    timeLimitSeconds,
  }
}
