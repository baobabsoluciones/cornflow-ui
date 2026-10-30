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
      <CoreMultiSelect
        v-if="field.multiple"
        :model-value="values[field.key] ?? []"
        :options="optionsOf(field)"
        :placeholder="field.required ? $t('createExecution.data.choose') : $t('createExecution.data.notSet')"
        :search-placeholder="$t('createExecution.data.searchOptions')"
        :no-matches-text="$t('createExecution.data.noMatchingOptions')"
        :clear-text="$t('createExecution.data.clearPicked')"
        :invalid="isInvalid(field)"
        @update:model-value="$emit('change', field.key, $event.length > 0 ? $event : null)"
      />
      <CoreSelect
        v-else-if="optionsOf(field).length > 0"
        :model-value="values[field.key]"
        :options="optionsOf(field)"
        :placeholder="field.required ? $t('createExecution.data.choose') : $t('createExecution.data.notSet')"
        clearable
        :invalid="isInvalid(field)"
        @update:model-value="$emit('change', field.key, $event)"
      />
      <CoreTextField
        v-else
        :type="field.type === 'date' ? 'date' : field.type === 'number' || field.type === 'float' ? 'number' : 'text'"
        :integer="field.type === 'number'"
        :model-value="values[field.key]"
        :invalid="isInvalid(field)"
        lazy
        @update:model-value="$emit('change', field.key, $event === '' ? null : $event)"
      />
    </label>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CoreMultiSelect from '@cornflow-ui/core/components/core/CoreMultiSelect.vue'
import CoreSelect from '@cornflow-ui/core/components/core/CoreSelect.vue'
import CoreTextField from '@cornflow-ui/core/components/core/CoreTextField.vue'
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

defineEmits<{ change: [key: string, value: unknown] }>()

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
</style>
