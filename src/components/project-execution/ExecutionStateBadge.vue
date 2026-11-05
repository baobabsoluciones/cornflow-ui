<!--
  ExecutionStateBadge: the state of an execution, or of its solution, as the app config names it.

  Variants: chip (label in a pill), icon (just the icon, for rows) and text (dot and label).
  `showMessage` adds the state's explanation under the chip. The explanation is always the tooltip.

  <ExecutionStateBadge kind="execution" :code="execution.state" show-message />
  <ExecutionStateBadge kind="solution" :code="execution.solution_state?.status_code" variant="text" />
-->
<template>
  <span :class="['execution-state', `execution-state--${variant}`]">
    <span
      v-if="variant === 'icon' && status.spin"
      role="img"
      :aria-label="tooltip"
      :title="tooltip"
      :class="[
        'execution-state__icon',
        'execution-state__spinner',
        `is-${status.tone}`,
      ]"
    >
      <CoreSpinner :size="iconSize - 4" />
    </span>
    <CoreIcon
      v-else-if="variant === 'icon'"
      :name="status.icon"
      :size="iconSize"
      :label="tooltip"
      :title="tooltip"
      :class="['execution-state__icon', `is-${status.tone}`]"
    />
    <CoreBadge
      v-else
      :label="status.label"
      :tone="status.tone"
      :icon="variant === 'chip' ? status.icon : undefined"
      :spin="status.spin"
      :variant="variant === 'text' ? 'dot' : 'soft'"
      :title="tooltip"
    />
    <span
      v-if="showMessage && variant === 'chip' && status.message"
      class="execution-state__message"
    >
      {{ status.message }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CoreBadge from '@cornflow-ui/core/components/core/CoreBadge.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSpinner from '@cornflow-ui/core/components/core/CoreSpinner.vue'
import { useExecutionStatus } from '@cornflow-ui/core/composables/project-execution/useExecutionStatus'

defineOptions({ name: 'ExecutionStateBadge' })

const props = withDefaults(
  defineProps<{
    kind: 'execution' | 'solution'
    /** Execution state, or solution `status_code`. */
    code: number | null | undefined
    variant?: 'chip' | 'icon' | 'text'
    showMessage?: boolean
    /** Size of the icon variant, in px. */
    iconSize?: number
  }>(),
  { variant: 'chip', showMessage: false, iconSize: 18 },
)

const { executionStatus, solutionStatus } = useExecutionStatus()

const status = computed(() =>
  props.kind === 'execution'
    ? executionStatus(props.code)
    : solutionStatus(props.code),
)

const tooltip = computed(() =>
  status.value.message && status.value.message !== status.value.label
    ? `${status.value.label} — ${status.value.message}`
    : status.value.label,
)
</script>

<style scoped>
.execution-state {
  display: inline-flex;
  min-width: 0;
}

.execution-state--chip {
  flex-direction: column;
  align-items: flex-start;
  gap: calc(var(--spacing) * 1);
}

.execution-state__message {
  font-size: var(--text-sm);
  line-height: 16px;
  color: var(--color-text-muted);
  text-wrap: pretty;
}

.execution-state__icon {
  cursor: help;
}

.execution-state__spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
}

.execution-state__icon.is-primary {
  color: var(--color-primary);
}

.execution-state__icon.is-info {
  color: var(--color-info);
}

.execution-state__icon.is-success {
  color: var(--color-success);
}

.execution-state__icon.is-warning {
  color: var(--color-warning);
}

.execution-state__icon.is-danger {
  color: var(--color-danger);
}

.execution-state__icon.is-neutral {
  color: var(--color-neutral);
}
</style>
