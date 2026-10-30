/**
 * How an execution state and a solution state look: label and message from `executionStates` /
 * `solutionStates` of the app config, tone from the state's `color`, and an icon.
 *
 * A state can name its own icon in the config (`icon: 'mdi-…'`). Running and queued executions
 * look the same in every app (a turning icon, a clock), whatever their colour.
 */
import { useExecutionState } from '@cornflow-ui/core/composables/project-execution-table/useExecutionState'
import type { CoreTone } from '@cornflow-ui/core/types/ui'

/** Execution state of an execution that finished with a solution. */
export const SUCCESS_STATE = 1

/** Execution states of an execution that has not finished. */
export const RUNNING_STATE = 0
export const QUEUED_STATE = -7

export const isExecutionActive = (state: number | null | undefined): boolean =>
  state === RUNNING_STATE || state === QUEUED_STATE

/** Execution states of an execution that ended without a solution. */
export const FAILED_STATES = [-1, -2, -3, -5, -6]

export interface StatusDisplay {
  label: string
  message: string
  tone: CoreTone
  icon: string
  spin: boolean
}

const TONE_BY_COLOR: Record<string, CoreTone> = {
  green: 'success',
  success: 'success',
  red: 'danger',
  error: 'danger',
  danger: 'danger',
  orange: 'warning',
  amber: 'warning',
  yellow: 'warning',
  warning: 'warning',
  purple: 'primary',
  primary: 'primary',
  blue: 'info',
  info: 'info',
  grey: 'neutral',
  gray: 'neutral',
}

/** Tone of a state's `color` (a Vuetify colour name, as the config declares them). */
export const toneOfColor = (color: string | undefined): CoreTone =>
  TONE_BY_COLOR[String(color ?? '').toLowerCase()] ?? 'neutral'

const EXECUTION_ICONS: Record<CoreTone, string> = {
  success: 'mdi-check-circle',
  danger: 'mdi-alert-circle',
  warning: 'mdi-minus-circle',
  info: 'mdi-information',
  primary: 'mdi-progress-clock',
  neutral: 'mdi-help-circle',
}

const SOLUTION_ICONS: Record<CoreTone, string> = {
  success: 'mdi-check-decagram',
  danger: 'mdi-close-circle',
  warning: 'mdi-alert-circle-outline',
  info: 'mdi-information-outline',
  primary: 'mdi-information-outline',
  neutral: 'mdi-help-circle-outline',
}

export function useExecutionStatus() {
  const { getStateInfo, getSolutionInfo, stateInfo, solutionStateInfo } =
    useExecutionState()

  const configuredIcon = (
    states: Record<string, unknown>,
    code: number | null | undefined,
  ) =>
    code === null || code === undefined
      ? undefined
      : ((states[String(code)] as { icon?: string } | undefined)?.icon ??
        undefined)

  function executionStatus(state: number | null | undefined): StatusDisplay {
    const info = getStateInfo(state)
    const icon = configuredIcon(stateInfo.value, state)
    if (state === RUNNING_STATE) {
      return {
        label: info.code,
        message: info.message,
        tone: 'primary',
        icon: icon ?? 'mdi-loading',
        spin: !icon,
      }
    }
    if (state === QUEUED_STATE) {
      return {
        label: info.code,
        message: info.message,
        tone: 'neutral',
        icon: icon ?? 'mdi-clock-outline',
        spin: false,
      }
    }
    const tone = toneOfColor(info.color)
    return {
      label: info.code,
      message: info.message,
      tone,
      icon: icon ?? EXECUTION_ICONS[tone],
      spin: false,
    }
  }

  function solutionStatus(
    statusCode: number | null | undefined,
  ): StatusDisplay {
    const info = getSolutionInfo(
      statusCode === null || statusCode === undefined
        ? null
        : { status_code: statusCode },
    )
    const tone = toneOfColor(info.color)
    return {
      label: info.code,
      message: info.message,
      tone,
      icon:
        configuredIcon(solutionStateInfo.value, statusCode) ??
        SOLUTION_ICONS[tone],
      spin: false,
    }
  }

  /** A finished execution reads as its solution ("Optimal"); any other, as its own state. */
  function displayStatus(
    state: number | null | undefined,
    solutionCode: number | null | undefined,
  ): StatusDisplay {
    return state === SUCCESS_STATE && solutionCode !== null && solutionCode !== undefined
      ? solutionStatus(solutionCode)
      : executionStatus(state)
  }

  return { executionStatus, solutionStatus, displayStatus }
}
