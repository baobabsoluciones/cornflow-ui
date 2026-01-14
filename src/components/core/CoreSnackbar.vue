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
  <v-snackbar
    v-model="snackbar.show"
    :color="snackbar.color"
    :timeout="effectiveTimeout"
  >
    <span>{{ snackbar.message }}</span>
    <template #actions>
      <v-icon @click="handleClose">mdi-close</v-icon>
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
}
</script>
