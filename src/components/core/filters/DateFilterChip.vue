<template>
  <FilterChip
    v-bind="$attrs"
    :label="label"
    icon="mdi-calendar-blank-outline"
    :value="modelValue"
    :options="presetOptions"
    :keep-open-value="customValue"
    @pick="emit('update:modelValue', $event)"
  >
    <template #after-options>
      <div v-if="modelValue === customValue" class="date-filter__range">
        <v-text-field
          :model-value="from"
          type="date"
          :label="fromLabel"
          variant="outlined"
          density="compact"
          hide-details
          data-testid="date-filter-from"
          @update:model-value="emit('update:from', $event)"
        />
        <v-text-field
          :model-value="to"
          type="date"
          :label="toLabel"
          variant="outlined"
          density="compact"
          hide-details
          data-testid="date-filter-to"
          @update:model-value="emit('update:to', $event)"
        />
      </div>
    </template>
  </FilterChip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import FilterChip from '@cornflow-ui/core/components/core/filters/FilterChip.vue'
import { parseLocalDateKey } from '@cornflow-ui/core/utils/date'

defineOptions({ name: 'CoreDateFilterChip', inheritAttrs: false })

export interface DatePreset {
  value: string
  label: string
}

const props = withDefaults(
  defineProps<{
    label: string
    /** Picked preset value. */
    modelValue: string | null
    presets: DatePreset[]
    /** Preset that asks for a range; its days are `from` and `to` (YYYY-MM-DD). */
    customValue?: string
    from?: string | null
    to?: string | null
    fromLabel: string
    toLabel: string
  }>(),
  { customValue: 'custom', from: null, to: null },
)

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
  'update:from': [value: string]
  'update:to': [value: string]
}>()

const formatDay = (day: string): string =>
  parseLocalDateKey(day).toLocaleDateString()

/** The presets, with the custom one showing its range once both days are given. */
const presetOptions = computed(() =>
  props.presets.map((preset) => ({
    value: preset.value,
    title:
      preset.value === props.customValue && props.from && props.to
        ? `${formatDay(props.from)} – ${formatDay(props.to)}`
        : preset.label,
  })),
)
</script>

<style>
.date-filter__range {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 8px 12px 4px;
}
</style>
