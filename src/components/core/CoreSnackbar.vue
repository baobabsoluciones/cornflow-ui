<!--
  CoreSnackbar: the app's toast, at the bottom centre of the window. It shows what `showSnackbar`
  (services/SnackbarService) puts in the injected `snackbar` state, and hides itself after the
  timeout. A truncated message can be downloaded whole.
-->
<template>
  <Teleport to="body">
    <Transition name="core-snackbar">
      <div
        v-if="snackbar.show"
        class="core-snackbar"
        :role="kind === 'error' ? 'alert' : 'status'"
        data-testid="core-snackbar"
      >
        <CoreIcon
          :name="ICONS[kind]"
          :size="18"
          :class="['core-snackbar__icon', `is-${kind}`]"
        />
        <span class="core-snackbar__message">{{ snackbar.message }}</span>
        <button
          v-if="snackbar.fullMessage"
          type="button"
          class="core-snackbar__download"
          data-testid="core-snackbar-download"
          @click="downloadFullMessage"
        >
          <CoreIcon name="mdi-download" :size="16" />
          {{ $t('table.downloadFullMessage') }}
        </button>
        <button
          type="button"
          class="core-snackbar__close"
          :aria-label="$t('common.close')"
          data-testid="core-snackbar-close"
          @click="handleClose"
        >
          <CoreIcon name="mdi-close" :size="16" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, watch } from 'vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import type {
  SnackbarColor,
  SnackbarState,
} from '@cornflow-ui/core/services/SnackbarService'
import {
  DEFAULT_TIMEOUT,
  SNACKBAR_COLORS,
} from '@cornflow-ui/core/services/SnackbarService'

interface Props {
  timeout?: number
}

const props = withDefaults(defineProps<Props>(), {
  timeout: DEFAULT_TIMEOUT,
})

// Snackbar state provided by App.vue
const snackbar = inject<SnackbarState>('snackbar')!

const ICONS: Record<SnackbarColor, string> = {
  success: 'mdi-check-circle',
  warning: 'mdi-alert',
  error: 'mdi-alert-circle',
  info: 'mdi-information',
}

/** The kind of message, from the colour `showSnackbar` set. */
const kind = computed<SnackbarColor>(
  () =>
    (Object.keys(SNACKBAR_COLORS) as SnackbarColor[]).find(
      (key) => SNACKBAR_COLORS[key] === snackbar.color,
    ) ?? 'info',
)

/** The service's timeout for this message, or the prop. */
const effectiveTimeout = computed(() => snackbar.timeout || props.timeout)

let hideTimer: ReturnType<typeof setTimeout> | null = null

function clearHideTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

const handleClose = (): void => {
  clearHideTimer()
  snackbar.show = false
  snackbar.fullMessage = null
}

// Every new message starts its own countdown.
watch(
  () => [snackbar.show, snackbar.message, effectiveTimeout.value] as const,
  ([show]) => {
    clearHideTimer()
    if (show && effectiveTimeout.value > 0) {
      hideTimer = setTimeout(handleClose, effectiveTimeout.value)
    }
  },
  { immediate: true },
)

onBeforeUnmount(clearHideTimer)

// Download full message as .txt when truncated
const downloadFullMessage = (): void => {
  if (!snackbar.fullMessage) return
  const blob = new Blob([snackbar.fullMessage], {
    type: 'text/plain;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `message-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.txt`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.core-snackbar {
  position: fixed;
  bottom: calc(var(--spacing) * 5);
  left: 50%;
  z-index: var(--z-toast);
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2.5);
  max-width: min(640px, calc(100vw - 32px));
  box-sizing: border-box;
  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 2)
    calc(var(--spacing) * 2.5) calc(var(--spacing) * 4);
  border-radius: var(--radius-md);
  background: var(--color-inverse);
  box-shadow: var(--shadow-lg);
  font-family: var(--font-sans);
  font-size: var(--text-md);
  color: var(--color-on-inverse);
  transform: translateX(-50%);
}

.core-snackbar__icon.is-success {
  color: color-mix(in srgb, var(--color-success) 45%, var(--color-on-inverse));
}

.core-snackbar__icon.is-warning {
  color: var(--color-warning);
}

.core-snackbar__icon.is-error {
  color: color-mix(in srgb, var(--color-danger) 55%, var(--color-on-inverse));
}

.core-snackbar__icon.is-info {
  color: color-mix(in srgb, var(--color-info) 45%, var(--color-on-inverse));
}

.core-snackbar__message {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.core-snackbar__download,
.core-snackbar__close {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: calc(var(--spacing) * 1);
  padding: calc(var(--spacing) * 1) calc(var(--spacing) * 2);
  border: 0;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-on-inverse) 12%, transparent);
  font: inherit;
  font-weight: var(--font-weight-medium);
  color: inherit;
  cursor: pointer;
}

.core-snackbar__close {
  padding: calc(var(--spacing) * 1);
  background: none;
}

.core-snackbar__download:hover,
.core-snackbar__close:hover {
  background: color-mix(in srgb, var(--color-on-inverse) 20%, transparent);
}

.core-snackbar__download:focus-visible,
.core-snackbar__close:focus-visible {
  outline: 2px solid var(--color-on-inverse);
  outline-offset: 1px;
}

.core-snackbar-enter-active,
.core-snackbar-leave-active {
  transition:
    opacity var(--duration-base) var(--ease-standard),
    transform var(--duration-base) var(--ease-standard);
}

.core-snackbar-enter-from,
.core-snackbar-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
