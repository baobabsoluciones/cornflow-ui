<!--
  DateFilterChip: the date filter of a list, with presets (today, last 7 days…) and a custom range
  that asks for its first and last day without closing the menu.
-->
<template>
  <FilterChip
    v-bind="$attrs"
    :label="label"
    icon="mdi-calendar-blank-outline"
    :value="modelValue"
    :options="presetOptions"
    :keep-open-value="customValue"
    :menu-width="300"
    @pick="emit('update:modelValue', $event)"
  >
    <template #after-options>
      <div v-if="modelValue === customValue" class="date-filter__range">
        <label class="date-filter__field">
          <span class="date-filter__label">{{ fromLabel }}</span>
          <input
            class="date-filter__input"
            type="date"
            :value="from ?? ''"
            :max="to ?? undefined"
            data-testid="date-filter-from"
            @input="
              emit('update:from', ($event.target as HTMLInputElement).value)
            "
          />
        </label>
        <label class="date-filter__field">
          <span class="date-filter__label">{{ toLabel }}</span>
          <input
            class="date-filter__input"
            type="date"
            :value="to ?? ''"
            :min="from ?? undefined"
            data-testid="date-filter-to"
            @input="
              emit('update:to', ($event.target as HTMLInputElement).value)
            "
          />
        </label>
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

<style scoped>
.date-filter__range {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: calc(var(--spacing) * 2);
  margin-top: calc(var(--spacing) * 1.5);
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 1)
    calc(var(--spacing) * 1);
  border-top: 1px solid var(--color-divider);
}

.date-filter__field {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1);
  min-width: 0;
}

.date-filter__label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.date-filter__input {
  height: 32px;
  min-width: 0;
  box-sizing: border-box;
  padding: 0 calc(var(--spacing) * 2);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-family: var(--font-sans);
  font-size: var(--text-md);
  color: var(--color-text);
}

.date-filter__input:focus {
  border-color: var(--color-primary);
  outline: none;
}
</style>
