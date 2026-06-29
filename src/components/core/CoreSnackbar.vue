<!--
/**
 * CoreSnackbar component
 * 
 * A reusable snackbar/toast notification component for displaying feedback messages.
 * 
 * Features:
 * - Customizable timeout duration
 * - Multiple color variants (success, error, warning, info)
 * - Closeable via close icon
 * - Uses reactive snackbar service for global state
 * - Automatic longer timeout for error messages (6000ms vs 3000ms default)
 * 
 * Props:
 * - timeout (Number): Duration in milliseconds before auto-hide (default: 3000)
 * 
 * Usage examples:
 * 
 * Basic usage (uses service default timeout):
 * <CoreSnackbar />
 * 
 * Custom timeout via prop:
 * <CoreSnackbar :timeout="5000" />
 * 
 * To show snackbar from any component:
 * import { showSnackbar } from '@/services/SnackbarService'
 * showSnackbar('Operation successful!', 'success')      // 3000ms timeout
 * showSnackbar('Error occurred', 'error')               // 6000ms timeout (auto)
 * showSnackbar('Custom timeout', 'warning', 10000)      // 10000ms timeout
 * 
 * Available colors (CSS variables from variables.css):
 * - success: var(--success) - default
 * - error: var(--danger) - auto 6000ms timeout
 * - warning: var(--warning)
 * - info: var(--primary)
 */
-->

<template>
  <!-- Mount only while open so VOverlay does not run persisted transition with model false (Vue 3.5 slot warn). -->
  <v-snackbar
    v-if="snackbar.show"
    :model-value="true"
    :color="snackbar.color"
    :timeout="effectiveTimeout"
    @update:model-value="onSnackbarModelUpdate"
  >
    <span>{{ snackbar.message }}</span>
    <template #actions>
      <v-btn
        v-if="snackbar.fullMessage"
        variant="tonal"
        size="small"
        color="white"
        class="core-snackbar__download-btn"
        :aria-label="$t('table.downloadFullMessage')"
        @click="downloadFullMessage"
      >
        <v-icon size="small" class="me-1">mdi-download</v-icon>
        {{ $t('table.downloadFullMessage') }}
      </v-btn>
      <v-btn
        icon="mdi-close"
        variant="text"
        size="small"
        color="white"
        :aria-label="$t('common.close')"
        @click="handleClose"
      />
    </template>
  </v-snackbar>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import type { SnackbarState } from '@/services/SnackbarService'
import { DEFAULT_TIMEOUT } from '@/services/SnackbarService'

// Props
interface Props {
  timeout?: number
}

const props = withDefaults(defineProps<Props>(), {
  timeout: DEFAULT_TIMEOUT,
})

// Inject snackbar state from App.vue
const snackbar = inject<SnackbarState>('snackbar')!

// Computed timeout: prioritize service timeout if set, otherwise use prop
const effectiveTimeout = computed(() => {
  return snackbar.timeout || props.timeout
})

// Handle close
const handleClose = (): void => {
  snackbar.show = false
  snackbar.fullMessage = null
}

const onSnackbarModelUpdate = (open: boolean | null): void => {
  if (open === false) handleClose()
}

// Download full message as .txt when truncated
const downloadFullMessage = (): void => {
  if (!snackbar.fullMessage) return
  const blob = new Blob([snackbar.fullMessage], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `message-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.txt`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.core-snackbar__download-btn {
  margin-right: 4px;
  text-transform: none;
  font-weight: 500;
}
</style>
