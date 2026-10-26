<!--
  LoadFiltersForm: the load filters of a new execution — the parameters the schema marks
  `pre_etl: true`, which the ETL filters the data it brings with — in a grid.

  <LoadFiltersForm :fields="draft.loadFilterFields" :values="draft.execution.config"
    :show-errors="tried" @change="draft.setFilter" />
-->
<template>
  <div class="load-filters" data-testid="load-filters">
    <label v-for="field in fields" :key="field.key" class="load-filters__field">
      <span class="load-filters__label">
        {{ labelOf(field) }}
        <span v-if="!field.required" class="load-filters__optional">{{ $t('createExecution.data.optional') }}</span>
      </span>
      <select
        v-if="optionsOf(field).length > 0"
        class="load-filters__control"
        :class="{ 'is-empty': isEmpty(field), 'is-invalid': isInvalid(field) }"
        :value="selectedIndex(field)"
        @change="onSelect(field, $event)"
      >
        <option value="">
          {{ field.required ? $t('createExecution.data.choose') : $t('createExecution.data.notSet') }}
        </option>
        <option v-for="(option, index) in optionsOf(field)" :key="index" :value="String(index)">
          {{ option.label }}
        </option>
      </select>
      <input
        v-else
        class="load-filters__control"
        :class="{ 'is-invalid': isInvalid(field) }"
        :type="field.type === 'date' ? 'date' : field.type === 'number' || field.type === 'float' ? 'number' : 'text'"
        :value="values[field.key] ?? ''"
        @change="onInput(field, $event)"
      />
    </label>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { isEmptyConfigValue } from '@cornflow-ui/core/composables/create-execution/configFieldValues'

defineOptions({ name: 'LoadFiltersForm' })

const props = withDefaults(
  defineProps<{
    fields: any[]
    values: Record<string, any>
    /** Mark the required filters that are still empty. */
    showErrors?: boolean
  }>(),
  { showErrors: false },
)

const emit = defineEmits<{ change: [key: string, value: unknown] }>()

const { t } = useI18n()

function labelOf(field: any) {
  return field.title ? t(field.title) : field.key
}

function optionsOf(field: any): { value: unknown; label: string }[] {
  if (field.type === 'boolean') {
    return [
      { value: true, label: t('createExecution.data.yes') },
      { value: false, label: t('createExecution.data.no') },
    ]
  }
  return field.options ?? []
}

function isEmpty(field: any) {
  return isEmptyConfigValue(field, props.values[field.key])
}

function isInvalid(field: any) {
  return props.showErrors && field.required && isEmpty(field)
}

function selectedIndex(field: any) {
  const index = optionsOf(field).findIndex((o) => o.value === props.values[field.key])
  return index === -1 ? '' : String(index)
}

function onSelect(field: any, event: Event) {
  const raw = (event.target as HTMLSelectElement).value
  emit('change', field.key, raw === '' ? null : optionsOf(field)[Number(raw)]?.value)
}

function onInput(field: any, event: Event) {
  const raw = (event.target as HTMLInputElement).value
  if (raw === '') emit('change', field.key, null)
  else if (field.type === 'number') emit('change', field.key, Number.parseInt(raw, 10))
  else if (field.type === 'float') emit('change', field.key, Number.parseFloat(raw))
  else emit('change', field.key, raw)
}
</script>

<style scoped>
.load-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: calc(var(--spacing) * 3) calc(var(--spacing) * 4);
  width: 100%;
  font-family: var(--font-sans);
}

.load-filters__field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  text-align: left;
}

.load-filters__label {
  display: flex;
  align-items: baseline;
  gap: calc(var(--spacing) * 1.5);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.load-filters__optional {
  font-weight: var(--font-weight-regular);
  color: var(--color-text-subtle);
}

.load-filters__control {
  box-sizing: border-box;
  min-width: 0;
  height: 36px;
  padding: 0 calc(var(--spacing) * 2);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-family: var(--font-sans);
  font-size: var(--text-md);
  color: var(--color-text);
}

.load-filters__control.is-empty {
  color: var(--color-text-subtle);
}

.load-filters__control.is-invalid {
  border-color: var(--color-danger-border);
}

.load-filters__control:focus {
  border-color: var(--color-primary);
  outline: none;
}
</style>
