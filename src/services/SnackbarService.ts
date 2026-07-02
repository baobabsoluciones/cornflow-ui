import { reactive } from 'vue'

export const MAX_SNACKBAR_MESSAGE_LENGTH = 150

export interface SnackbarState {
  show: boolean
  message: string
  /** Full message for download when message is truncated (length > MAX_SNACKBAR_MESSAGE_LENGTH). */
  fullMessage: string | null
  color: string
  timeout: number
}

// Timeout constants
export const DEFAULT_TIMEOUT = 3000
export const ERROR_TIMEOUT = 10000

// CSS variable references from variables.css
export const SNACKBAR_COLORS = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  error: 'var(--danger-variant)',
  info: 'var(--primary)',
} as const

export type SnackbarColor = keyof typeof SNACKBAR_COLORS

export const snackbar = reactive<SnackbarState>({
  show: false,
  message: '',
  fullMessage: null,
  color: SNACKBAR_COLORS.success,
  timeout: DEFAULT_TIMEOUT,
})

export function showSnackbar(
  message: string,
  color: SnackbarColor = 'success',
  timeout?: number,
): void {
  // Use longer timeout for errors if not explicitly specified
  const effectiveTimeout =
    timeout ?? (color === 'error' ? ERROR_TIMEOUT : DEFAULT_TIMEOUT)

  snackbar.show = true
  if (message.length > MAX_SNACKBAR_MESSAGE_LENGTH) {
    snackbar.message = message.slice(0, MAX_SNACKBAR_MESSAGE_LENGTH) + '…'
    snackbar.fullMessage = message
  } else {
    snackbar.message = message
    snackbar.fullMessage = null
  }
  snackbar.color = SNACKBAR_COLORS[color]
  snackbar.timeout = effectiveTimeout
}

export function hideSnackbar(): void {
  snackbar.show = false
  snackbar.fullMessage = null
}
