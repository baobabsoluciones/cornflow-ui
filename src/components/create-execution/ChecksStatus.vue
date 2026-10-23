<!--
  ChecksStatus: where the data checks of a new execution stand (not run, running, fine, with
  warnings, with errors, out of date) with the button that runs them, and what they found, one
  collapsible group per check table.

  <ChecksStatus
    :status="draft.checks.status"
    :results="draft.checks.results"
    :checked-at="draft.checks.checkedAt"
    :blocking="draft.blockOnCheckErrors"
    @run="draft.runChecks()"
  />
-->
<template>
  <div
    class="checks-status"
    :class="{ 'is-highlighted': highlight }"
    data-testid="checks-status"
  >
    <div class="checks-status__head">
      <span class="checks-status__icon" :class="`is-${tone}`">
        <CoreSpinner v-if="status === 'running'" :size="16" />
        <CoreIcon v-else :name="icon" :size="18" />
      </span>
      <div class="checks-status__text">
        <span class="checks-status__title" :class="`is-${tone}`">{{ title }}</span>
        <span class="checks-status__subtitle">{{ subtitle }}</span>
      </div>
      <CoreButton
        v-if="status !== 'running'"
        :variant="status === 'none' || status === 'stale' ? 'outlined' : 'text'"
        size="small"
        icon="mdi-play-outline"
        :text="status === 'none' ? $t('createExecution.checks.run') : $t('createExecution.checks.runAgain')"
        :disabled="disabled"
        data-testid="checks-run"
        @click="$emit('run')"
      />
    </div>

    <div
      v-if="results.length > 0 && status !== 'running'"
      class="checks-status__results"
      :class="{ 'is-stale': status === 'stale' }"
    >
      <div v-for="result in results" :key="result.key" class="checks-status__result">
        <button
          type="button"
          class="checks-status__result-head"
          :aria-expanded="isOpen(result)"
          @click="toggle(result)"
        >
          <CoreIcon
            :name="result.kind === 'error' ? 'mdi-alert-circle' : 'mdi-alert'"
            :size="16"
            :class="`is-${result.kind === 'error' ? 'danger' : 'warning'}`"
          />
          <span class="checks-status__result-title">{{ result.title }}</span>
          <span class="checks-status__result-count">{{ result.rows.length }}</span>
          <CoreIcon :name="isOpen(result) ? 'mdi-chevron-up' : 'mdi-chevron-down'" :size="18" />
        </button>
        <ul v-if="isOpen(result)" class="checks-status__rows">
          <li v-for="(row, index) in visibleRows(result)" :key="index">{{ row }}</li>
          <li v-if="result.rows.length > MAX_ROWS" class="checks-status__more">
            {{ $t('createExecution.checks.moreRows', { count: result.rows.length - MAX_ROWS }) }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSpinner from '@cornflow-ui/core/components/core/CoreSpinner.vue'
import type {
  CheckResult,
  ChecksStatus,
} from '@cornflow-ui/core/composables/create-execution/useExecutionDraft'

defineOptions({ name: 'ChecksStatus' })

const props = withDefaults(
  defineProps<{
    status: ChecksStatus
    results?: CheckResult[]
    checkedAt?: Date | null
    /** Errors stop the launch (`enableBlockAdvanceOnCheckErrors`). */
    blocking?: boolean
    disabled?: boolean
    /** Draws attention to it (the user came here from "what is missing"). */
    highlight?: boolean
  }>(),
  { results: () => [], checkedAt: null, blocking: false, disabled: false, highlight: false },
)

defineEmits<{ run: [] }>()

const MAX_ROWS = 20

const { t } = useI18n()

const count = (kind: CheckResult['kind']) =>
  props.results.filter((r) => r.kind === kind).reduce((n, r) => n + r.rows.length, 0)

const tone = computed(() => {
  switch (props.status) {
    case 'running':
      return 'primary'
    case 'ok':
      return 'success'
    case 'warnings':
    case 'stale':
      return 'warning'
    case 'errors':
      return 'danger'
    default:
      return 'neutral'
  }
})

const icon = computed(
  () =>
    ({
      none: 'mdi-shield-search',
      running: 'mdi-loading',
      ok: 'mdi-check-circle',
      warnings: 'mdi-alert',
      errors: 'mdi-alert-circle',
      stale: 'mdi-history',
    })[props.status],
)

const checkedText = computed(() => {
  if (!props.checkedAt) return t('createExecution.checks.checkedNow')
  const time = props.checkedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return t('createExecution.checks.checkedAt', { time })
})

const title = computed(() => {
  const errors = count('error')
  const warnings = count('warning')
  switch (props.status) {
    case 'running':
      return t('createExecution.checks.running')
    case 'ok':
      return t('createExecution.checks.ok')
    case 'warnings':
      return t('createExecution.checks.warnings', { count: warnings }, warnings)
    case 'errors': {
      const errorsText = t('createExecution.checks.errors', { count: errors }, errors)
      return warnings
        ? `${errorsText} · ${t('createExecution.checks.warnings', { count: warnings }, warnings)}`
        : errorsText
    }
    case 'stale':
      return t('createExecution.checks.stale')
    default:
      return t('createExecution.checks.none')
  }
})

const subtitle = computed(() => {
  switch (props.status) {
    case 'running':
      return t('createExecution.checks.runningHint')
    case 'ok':
      return checkedText.value
    case 'warnings':
      return `${checkedText.value} · ${t('createExecution.checks.notBlocking')}`
    case 'errors':
      return props.blocking
        ? t('createExecution.checks.fixBeforeLaunch')
        : `${checkedText.value} · ${t('createExecution.checks.notBlocking')}`
    case 'stale':
      return t('createExecution.checks.staleHint')
    default:
      return t('createExecution.checks.noneHint')
  }
})

const opened = ref<Record<string, boolean>>({})

function isOpen(result: CheckResult): boolean {
  return opened.value[result.key] ?? (result.kind === 'error' || props.results.length === 1)
}

function toggle(result: CheckResult) {
  opened.value = { ...opened.value, [result.key]: !isOpen(result) }
}

function visibleRows(result: CheckResult): string[] {
  return result.rows.slice(0, MAX_ROWS)
}
</script>

<style scoped>
.checks-status {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2.5);
  border-radius: var(--radius-md);
  outline: 2px solid transparent;
  outline-offset: 4px;
  transition: outline-color var(--duration-base) var(--ease-standard);
  font-family: var(--font-sans);
  color: var(--color-text);
}

.checks-status.is-highlighted {
  outline-color: var(--color-danger);
}

.checks-status__head {
  display: flex;
  align-items: flex-start;
  gap: calc(var(--spacing) * 2.5);
}

.checks-status__icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
}

.checks-status__icon.is-neutral {
  background: var(--color-neutral-soft);
  color: var(--color-neutral);
}

.checks-status__icon.is-primary {
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}

.checks-status__icon.is-success {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.checks-status__icon.is-warning {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.checks-status__icon.is-danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.checks-status__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 1px;
}

.checks-status__title {
  font-size: var(--text-md);
  font-weight: var(--font-weight-bold);
}

.checks-status__title.is-primary {
  color: var(--color-primary);
}

.checks-status__title.is-success {
  color: var(--color-success-strong);
}

.checks-status__title.is-warning {
  color: var(--color-warning-strong);
}

.checks-status__title.is-danger {
  color: var(--color-danger-strong);
}

.checks-status__subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  text-wrap: pretty;
}

.checks-status__results {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.checks-status__results.is-stale {
  opacity: 0.6;
}

.checks-status__result + .checks-status__result {
  border-top: 1px solid var(--color-divider);
}

.checks-status__result-head {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  width: 100%;
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 2.5);
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.checks-status__result-head:hover {
  background: var(--color-surface-hover);
}

.checks-status__result-head .is-danger {
  color: var(--color-danger);
}

.checks-status__result-head .is-warning {
  color: var(--color-warning);
}

.checks-status__result-title {
  flex: 1;
  min-width: 0;
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
}

.checks-status__result-count {
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
}

.checks-status__rows {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1);
  margin: 0;
  padding: 0 calc(var(--spacing) * 2.5) calc(var(--spacing) * 2.5) calc(var(--spacing) * 8.5);
  list-style: none;
  font-size: var(--text-sm);
  color: var(--color-text);
}

.checks-status__more {
  color: var(--color-text-muted);
}
</style>
