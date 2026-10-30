<!--
  CoreTimeline: the steps of a process side by side, with where it is now.

  Each step is done, current, failed, skipped or pending. The current (or failed) step shows its
  own icon in its tone, and can carry a progress bar. The line to the next step is solid once that
  step has been reached and dashed while it is pending.

  <CoreTimeline title="Progress" :steps="[
    { key: 'queued', label: 'Queued', time: '10:30', description: 'Waited 4 s', status: 'done' },
    { key: 'run', label: 'Running', time: '10:30', description: '12 min of 15 min', status: 'current',
      tone: 'primary', icon: 'mdi-loading', spin: true, progress: 80 },
    { key: 'end', label: 'Finished', description: 'Pending', status: 'pending' },
  ]" />
-->
<template>
  <section class="core-timeline">
    <h3 v-if="title" class="core-timeline__title">{{ title }}</h3>
    <ol
      class="core-timeline__steps"
      :style="{
        gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
      }"
      :aria-label="title || undefined"
    >
      <li
        v-for="(step, index) in steps"
        :key="step.key"
        :class="[
          'core-timeline__step',
          `is-${step.status}`,
          `core-timeline__step--${toneOf(step)}`,
        ]"
        :aria-current="step.status === 'current' ? 'step' : undefined"
      >
        <div class="core-timeline__track">
          <span class="core-timeline__dot">
            <CoreSpinner v-if="step.spin" :size="14" />
            <CoreIcon v-else :name="iconOf(step)" :size="20" />
          </span>
          <span
            v-if="index < steps.length - 1"
            :class="[
              'core-timeline__line',
              { 'is-reached': steps[index + 1].status !== 'pending' },
            ]"
          />
        </div>
        <div class="core-timeline__text">
          <div class="core-timeline__heading">
            <span class="core-timeline__label">{{ step.label }}</span>
            <span v-if="step.time" class="core-timeline__time">{{
              step.time
            }}</span>
          </div>
          <span v-if="step.description" class="core-timeline__description">
            {{ step.description }}
          </span>
          <CoreProgressBar
            v-if="step.progress !== undefined && step.progress !== null"
            class="core-timeline__progress"
            :value="step.progress"
            :tone="toneOf(step)"
            :label="step.progressLabel"
          />
        </div>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSpinner from '@cornflow-ui/core/components/core/CoreSpinner.vue'
import CoreProgressBar from '@cornflow-ui/core/components/core/CoreProgressBar.vue'
import type { CoreTone } from '@cornflow-ui/core/types/ui'

defineOptions({ name: 'CoreTimeline' })

export interface TimelineStep {
  key: string
  label: string
  time?: string
  description?: string
  status: 'done' | 'current' | 'failed' | 'skipped' | 'pending'
  /** Tone of a current or failed step (by default primary and danger). */
  tone?: CoreTone
  /** Icon of a current or failed step. */
  icon?: string
  /** Something in progress: a spinner instead of the icon. */
  spin?: boolean
  /** 0–100: shows a progress bar under the step. */
  progress?: number | null
  progressLabel?: string
}

defineProps<{
  title?: string
  steps: TimelineStep[]
}>()

const STATUS_ICONS: Record<TimelineStep['status'], string> = {
  done: 'mdi-check-circle',
  current: 'mdi-circle-slice-4',
  failed: 'mdi-alert-circle',
  skipped: 'mdi-minus-circle-outline',
  pending: 'mdi-circle-outline',
}

function iconOf(step: TimelineStep): string {
  if ((step.status === 'current' || step.status === 'failed') && step.icon)
    return step.icon
  return STATUS_ICONS[step.status]
}

function toneOf(step: TimelineStep): CoreTone {
  if (step.tone) return step.tone
  if (step.status === 'failed') return 'danger'
  if (step.status === 'current' || step.status === 'done') return 'primary'
  return 'neutral'
}
</script>

<style scoped>
.core-timeline {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3.5);
  font-family: var(--font-sans);
}

.core-timeline__title {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-primary);
}

.core-timeline__steps {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.core-timeline__step {
  --step-base: var(--color-primary);
  --step-soft: var(--color-primary-subtle);
  --step-strong: var(--color-primary);

  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2);
  min-width: 0;
}

.core-timeline__step--info {
  --step-base: var(--color-info);
  --step-soft: var(--color-info-soft);
  --step-strong: var(--color-info-strong);
}

.core-timeline__step--success {
  --step-base: var(--color-success);
  --step-soft: var(--color-success-soft);
  --step-strong: var(--color-success-strong);
}

.core-timeline__step--warning {
  --step-base: var(--color-warning);
  --step-soft: var(--color-warning-soft);
  --step-strong: var(--color-warning-strong);
}

.core-timeline__step--danger {
  --step-base: var(--color-danger);
  --step-soft: var(--color-danger-soft);
  --step-strong: var(--color-danger-strong);
}

.core-timeline__step--neutral {
  --step-base: var(--color-neutral);
  --step-soft: var(--color-neutral-soft);
  --step-strong: var(--color-neutral-strong);
}

.core-timeline__track {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  min-width: 0;
}

.core-timeline__dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: var(--radius-full);
  color: var(--color-primary);
}

.is-current .core-timeline__dot,
.is-failed .core-timeline__dot {
  background: var(--step-soft);
  color: var(--step-base);
}

.is-skipped .core-timeline__dot {
  color: var(--color-text-subtle);
}

.is-pending .core-timeline__dot {
  color: var(--color-border-strong);
}

.core-timeline__line {
  flex: 1;
  min-width: 8px;
  margin-right: calc(var(--spacing) * 1.5);
  border-top: 2px dashed var(--color-neutral-border);
}

.core-timeline__line.is-reached {
  border-top-style: solid;
  border-top-color: var(--color-primary);
}

.core-timeline__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding-right: calc(var(--spacing) * 3);
}

.core-timeline__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: calc(var(--spacing) * 1.5);
}

.core-timeline__label {
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.is-current .core-timeline__label,
.is-failed .core-timeline__label {
  color: var(--step-strong);
}

.is-skipped .core-timeline__label {
  color: var(--color-text-muted);
}

.is-pending .core-timeline__label {
  color: var(--color-text-subtle);
}

.core-timeline__time {
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
  font-variant-numeric: tabular-nums;
}

.core-timeline__description {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  text-wrap: pretty;
}

.core-timeline__progress {
  max-width: 180px;
  margin-top: calc(var(--spacing) * 1.5);
}
</style>
