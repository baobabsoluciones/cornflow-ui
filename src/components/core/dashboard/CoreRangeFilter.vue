<!--
  CoreRangeFilter: the stretch of an ordered scale a dashboard shows (days, weeks, planning
  periods). The slider picks any range; the presets pick the usual ones in one click.

  - `v-model`: the positions [first, last] of the range, in `labels`.
  - `labels`: the label of each position, in order; the range reads "first → last".
  - `presets`: the usual ranges. A preset whose `range` is null is shown disabled (that stretch
    does not exist in this data). The one matching the current range is shown picked.
  - `summary`: what the count says ("8 of 13" if left out).

  <CoreRangeFilter v-model="range" label="Horizon" :labels="['Mon 3', 'Tue 4', 'Wk 10', 'Wk 17']"
    :presets="[{ value: 'all', label: 'All', range: [0, 3] }, { value: 'weeks', label: 'Weekly', range: [2, 3] }]" />
-->
<template>
  <div class="core-range-filter" data-testid="core-range-filter">
    <span v-if="label" class="core-range-filter__label">{{ label }}</span>
    <span class="core-range-filter__range">
      <CoreIcon name="mdi-calendar-range" :size="15" />
      <span>{{ rangeLabel }}</span>
    </span>
    <CoreRangeSlider
      :model-value="modelValue"
      :max="last"
      :disabled="labels.length < 2"
      ticks
      class="core-range-filter__slider"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <span class="core-range-filter__count">{{ countLabel }}</span>
    <CoreSegmentedControl
      v-if="presets.length"
      :model-value="picked"
      :options="presetOptions"
      variant="soft"
      size="small"
      class="core-range-filter__presets"
      @update:model-value="applyPreset"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreRangeSlider from '@cornflow-ui/core/components/core/CoreRangeSlider.vue'
import CoreSegmentedControl from '@cornflow-ui/core/components/core/CoreSegmentedControl.vue'

defineOptions({ name: 'CoreRangeFilter' })

export interface CoreRangePreset {
  value: string
  label: string
  /** Positions [first, last] the preset picks; null when that stretch does not exist. */
  range: [number, number] | null
}

const props = withDefaults(
  defineProps<{
    modelValue: [number, number]
    labels: string[]
    label?: string
    presets?: CoreRangePreset[]
    summary?: string
  }>(),
  { label: '', presets: () => [], summary: '' },
)

const emit = defineEmits<{ 'update:modelValue': [value: [number, number]] }>()

const { t } = useI18n()

const last = computed(() => Math.max(props.labels.length - 1, 0))

const presetOptions = computed(() =>
  props.presets.map((preset) => ({ value: preset.value, label: preset.label, disabled: !preset.range })),
)

const picked = computed(() => {
  const [from, to] = props.modelValue
  return props.presets.find((preset) => preset.range?.[0] === from && preset.range?.[1] === to)?.value ?? null
})

const rangeLabel = computed(() => {
  const [from, to] = props.modelValue
  if (props.labels.length === 0) return '·'
  return from === to ? props.labels[from] : `${props.labels[from]} → ${props.labels[to]}`
})

const countLabel = computed(() => {
  if (props.summary) return props.summary
  const [from, to] = props.modelValue
  return t('dashboard.range.shown', { shown: props.labels.length ? to - from + 1 : 0, count: props.labels.length })
})

function applyPreset(value: unknown) {
  const range = props.presets.find((preset) => preset.value === value)?.range
  if (range) emit('update:modelValue', [range[0], range[1]])
}
</script>

<style scoped>
.core-range-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(var(--spacing) * 2) calc(var(--spacing) * 4);
  min-width: 0;
  font-family: var(--font-sans);
  font-size: var(--text-md);
  color: var(--color-text);
}

.core-range-filter__label {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.core-range-filter__range {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  height: 30px;
  padding: 0 calc(var(--spacing) * 3);
  border-radius: var(--radius-md);
  background: var(--color-primary-subtle);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.core-range-filter__slider {
  flex: 1 1 200px;
  min-width: 160px;
}

.core-range-filter__count {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.core-range-filter__presets {
  margin-left: auto;
}
</style>
