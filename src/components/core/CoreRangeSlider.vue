<!--
  CoreRangeSlider: picks a range between two thumbs on a track, by mouse or with the arrows.

  - `v-model`: the pair [from, to].
  - `ticks`: a dot for each step, for short scales where each step is a thing (a day, a period).
  - `labels`: the accessible names of the two thumbs ("From" and "To" if left out).

  <CoreRangeSlider v-model="range" :min="0" :max="12" ticks :labels="['First period', 'Last period']" />
-->
<template>
  <SliderRoot
    :model-value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    class="core-range-slider"
    :class="{ 'is-disabled': disabled }"
    @update:model-value="onUpdate"
  >
    <SliderTrack class="core-range-slider__track">
      <span v-if="ticks" class="core-range-slider__ticks" aria-hidden="true">
        <span
          v-for="tick in tickPositions"
          :key="tick.value"
          class="core-range-slider__tick"
          :class="{ 'is-in': tick.value >= modelValue[0] && tick.value <= modelValue[1] }"
          :style="{ left: `${tick.position}%` }"
        />
      </span>
      <SliderRange class="core-range-slider__range" />
    </SliderTrack>
    <SliderThumb class="core-range-slider__thumb" :aria-label="labels?.[0] ?? $t('common.from')" />
    <SliderThumb class="core-range-slider__thumb" :aria-label="labels?.[1] ?? $t('common.to')" />
  </SliderRoot>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'

defineOptions({ name: 'CoreRangeSlider' })

/** Most dots the track shows: past this, ticks would blur into a line. */
const MAX_TICKS = 60

const props = withDefaults(
  defineProps<{
    modelValue: [number, number]
    min?: number
    max: number
    step?: number
    disabled?: boolean
    ticks?: boolean
    labels?: [string, string]
  }>(),
  { min: 0, step: 1, disabled: false, ticks: false, labels: undefined },
)

const emit = defineEmits<{ 'update:modelValue': [value: [number, number]] }>()

const tickPositions = computed(() => {
  const span = props.max - props.min
  const count = Math.floor(span / props.step) + 1
  if (span <= 0 || count > MAX_TICKS) return []
  return Array.from({ length: count }, (_, index) => {
    const value = props.min + index * props.step
    return { value, position: ((value - props.min) / span) * 100 }
  })
})

function onUpdate(value: number[] | undefined) {
  if (value && value.length === 2) emit('update:modelValue', [value[0], value[1]])
}
</script>

<style scoped>
.core-range-slider {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 24px;
  touch-action: none;
  user-select: none;
}

.core-range-slider__track {
  position: relative;
  flex: 1;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--color-neutral-soft);
}

.core-range-slider__range {
  position: absolute;
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--color-primary);
}

.core-range-slider__ticks {
  position: absolute;
  inset: 0;
}

.core-range-slider__tick {
  position: absolute;
  top: 50%;
  z-index: 1;
  width: 4px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--color-border-strong);
  transform: translate(-50%, -50%);
}

.core-range-slider__tick.is-in {
  background: var(--color-on-primary);
  opacity: 0.7;
}

.core-range-slider__thumb {
  display: block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  cursor: grab;
  transition: box-shadow var(--duration-fast) var(--ease-standard);
}

.core-range-slider__thumb:hover {
  box-shadow: 0 0 0 6px var(--color-primary-subtle);
}

.core-range-slider__thumb:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--color-primary-soft);
}

.core-range-slider__thumb:active {
  cursor: grabbing;
}

.core-range-slider.is-disabled {
  opacity: 0.5;
}

.core-range-slider.is-disabled .core-range-slider__thumb {
  cursor: not-allowed;
}
</style>
