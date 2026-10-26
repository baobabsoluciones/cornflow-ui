<!--
  ChecksStatus: where the data checks of a new execution stand (not run, running, fine, with
  warnings, with errors, out of date) with the button that runs them, and what they found: one line
  per check with how many rows it found, errors first. Any of them opens the detail
  (ChecksDetailDialog), with each check as a table.

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
    </div>

    <ul
      v-if="results.length > 0 && status !== 'running'"
      class="checks-status__results"
      :class="{ 'is-stale': status === 'stale' }"
    >
      <li v-for="result in listed" :key="result.key">
        <button
          type="button"
          class="checks-status__result"
          :title="result.title"
          @click="openDetail(result.key)"
        >
          <CoreIcon
            :name="result.kind === 'error' ? 'mdi-alert-circle' : 'mdi-alert'"
            :size="16"
            :class="`is-${result.kind === 'error' ? 'danger' : 'warning'}`"
          />
          <span class="checks-status__result-title">{{ result.title }}</span>
          <span class="checks-status__result-count">{{ result.records.length }}</span>
        </button>
      </li>
      <li v-if="results.length > MAX_LISTED">
        <button type="button" class="checks-status__result is-more" @click="openDetail(null)">
          {{ $t('createExecution.checks.moreChecks', { count: results.length - MAX_LISTED }, results.length - MAX_LISTED) }}
        </button>
      </li>
    </ul>

    <div v-if="status !== 'running'" class="checks-status__actions">
      <CoreButton
        v-if="results.length > 0"
        variant="text"
        size="small"
        icon="mdi-table-eye"
        :text="$t('createExecution.checks.seeDetail')"
        data-testid="checks-detail-open"
        @click="openDetail(null)"
      />
      <span class="checks-status__spacer" />
      <CoreButton
        :variant="status === 'none' || status === 'stale' ? 'outlined' : 'text'"
        size="small"
        :icon="status === 'none' ? 'mdi-play-outline' : 'mdi-refresh'"
        :text="status === 'none' ? $t('createExecution.checks.run') : $t('createExecution.checks.runAgain')"
        :disabled="disabled"
        data-testid="checks-run"
        @click="$emit('run')"
      />
    </div>

    <ChecksDetailDialog v-model="detailOpen" :results="results" :initial-key="detailKey" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSpinner from '@cornflow-ui/core/components/core/CoreSpinner.vue'
import ChecksDetailDialog from '@cornflow-ui/core/components/create-execution/ChecksDetailDialog.vue'
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

/** Checks listed in the panel; the rest are in the detail. */
const MAX_LISTED = 6

const { t } = useI18n()

const count = (kind: CheckResult['kind']) =>
  props.results.filter((r) => r.kind === kind).reduce((n, r) => n + r.records.length, 0)

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

const listed = computed(() => props.results.slice(0, MAX_LISTED))

const detailOpen = ref(false)
const detailKey = ref<string | null>(null)

function openDetail(key: string | null) {
  detailKey.value = key
  detailOpen.value = true
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
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.checks-status__results.is-stale {
  opacity: 0.6;
}

.checks-status__results li + li {
  border-top: 1px solid var(--color-divider);
}

.checks-status__result {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  width: 100%;
  min-height: 34px;
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 2.5);
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--text-sm);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.checks-status__result:hover {
  background: var(--color-surface-hover);
}

.checks-status__result.is-more {
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

.checks-status__result .is-danger {
  flex: none;
  color: var(--color-danger);
}

.checks-status__result .is-warning {
  flex: none;
  color: var(--color-warning);
}

.checks-status__result-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.checks-status__result-count {
  flex: none;
  min-width: 24px;
  padding: 0 calc(var(--spacing) * 1.5);
  border-radius: var(--radius-full);
  background: var(--color-neutral-soft);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  font-variant-numeric: tabular-nums;
  line-height: 20px;
  text-align: center;
  color: var(--color-text);
}

.checks-status__actions {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
}

.checks-status__spacer {
  flex: 1;
}
</style>
