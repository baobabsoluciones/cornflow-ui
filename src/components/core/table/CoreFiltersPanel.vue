<template>
  <v-expand-transition>
    <div v-if="showPanel" class="core-filters-panel ma-4 mt-0">
      <div class="d-flex flex-wrap align-center ga-2">
        <!-- Existing filter chips -->
        <v-chip
          v-for="filter in activeFilters"
          :key="filter.id"
          size="small"
          rounded="lg"
          variant="tonal"
          color="var(--sutitle)"
          closable
          @click:close="handleRemoveFilter(filter.id)"
          class="core-filters-panel__filter-chip"
        >
          {{ getFilterDisplayText(filter) }}
        </v-chip>

        <!-- Add Filter Button -->
        <v-menu
          v-model="showAddFilterMenu"
          :close-on-content-click="false"
          location="bottom start"
          offset="4"
        >
          <template v-slot:activator="{ props }">
            <v-btn
              icon="mdi-plus"
              variant="tonal"
              size="lg"
              rounded="lg"
              color="var(--sutitle)"
              v-bind="props"
              :title="t('table.filters.addCondition')"
            />
          </template>

          <!-- Add Filter Dropdown -->
          <v-card class="core-filters-panel__add-filter-card" min-width="320">
            <v-card-text class="pa-3">
              <div class="core-filters-panel__add-filter-form">
                <!-- Field Selection -->
                <v-select
                  v-model="newFilter.field"
                  :items="fieldOptions"
                  :label="t('table.filters.field')"
                  item-title="title"
                  item-value="key"
                  variant="outlined"
                  density="compact"
                  class="mb-2"
                  @update:model-value="handleNewFilterFieldChange"
                />

                <!-- Operator: hidden for date/datetime and boolean fields -->
                <v-select
                  v-if="!isDateOnlyFilterField && !isBooleanFilterField"
                  v-model="newFilter.operator"
                  :items="operatorOptions"
                  :label="t('table.filters.operator')"
                  item-title="text"
                  item-value="value"
                  variant="outlined"
                  density="compact"
                  class="mb-2"
                  @update:model-value="handleNewFilterOperatorChange"
                />

                <!-- Boolean: direct Sí/No selector, no operator needed -->
                <template v-if="isBooleanFilterField">
                  <v-select
                    v-model="newFilter.value"
                    :items="booleanOptions"
                    :label="t('table.filters.value')"
                    item-title="text"
                    item-value="value"
                    variant="outlined"
                    density="compact"
                    class="mb-2"
                  />
                </template>

                <!-- Date / datetime: only Desde + Hasta (operator is_between, hidden) -->
                <template v-else-if="isDateOnlyFilterField">
                  <div class="mb-2">
                    <v-text-field
                      v-model="newFilter.value"
                      :label="t('table.filters.dateFrom')"
                      :type="dateInputTypeForField(currentFieldType)"
                      variant="outlined"
                      density="compact"
                    />
                    <v-text-field
                      v-model="newFilter.value2"
                      :label="t('table.filters.dateTo')"
                      :type="dateInputTypeForField(currentFieldType)"
                      variant="outlined"
                      density="compact"
                      class="mt-2"
                    />
                  </div>
                </template>

                <!-- Value Input (non-date, non-boolean fields) -->
                <div
                  v-else-if="operatorNeedsValue(newFilter.operator)"
                  class="mb-2"
                >
                  <!-- String/Text input -->
                  <v-text-field
                    v-if="currentFieldType === 'string'"
                    v-model="newFilter.value"
                    :label="t('table.filters.value')"
                    variant="outlined"
                    density="compact"
                  />

                  <!-- Number input -->
                  <v-text-field
                    v-else-if="['number', 'integer'].includes(currentFieldType)"
                    v-model="newFilter.value"
                    :label="t('table.filters.value')"
                    type="number"
                    variant="outlined"
                    density="compact"
                  />

                  <!-- Fallback for unknown types -->
                  <v-text-field
                    v-else
                    v-model="newFilter.value"
                    :label="t('table.filters.value')"
                    variant="outlined"
                    density="compact"
                  />

                  <!-- Second value for "between" operator (numeric range) -->
                  <v-text-field
                    v-if="operatorNeedsSecondValue(newFilter.operator)"
                    v-model="newFilter.value2"
                    :label="t('table.filters.valueTo')"
                    :type="value2InputType"
                    variant="outlined"
                    density="compact"
                    class="mt-2"
                  />
                </div>

                <!-- Actions -->
                <div class="d-flex justify-end ga-2">
                  <CoreButton
                    :text="t('table.filters.cancel')"
                    variant="text"
                    size="small"
                    @click="cancelAddFilter"
                  />
                  <CoreButton
                    :text="t('table.filters.apply')"
                    variant="filled"
                    size="small"
                    color="primary"
                    :disabled="!isNewFilterValid"
                    @click="applyNewFilter"
                  />
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-menu>
      </div>
    </div>
  </v-expand-transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreButton from '@/components/core/CoreButton.vue'
import type {
  FilterCondition,
  FilterField,
  FilterOperator,
} from '@/composables/core-table/useTableFilters'
import { isDateLikeFieldType } from '@/utils/tableFilterUtils'

// Props
interface Props {
  showPanel: boolean
  activeFilters: FilterCondition[]
  availableFields: FilterField[]
  hasActiveFilters: boolean
  activeFiltersCount: number
  getOperatorsForFieldType: (fieldType: string) => string[]
  getOperatorText: (operator: string) => string
  operatorNeedsValue: (operator: string) => boolean
  operatorNeedsSecondValue: (operator: string) => boolean
  generateFilterId: () => string
}

const props = defineProps<Props>()

// Emits
interface Emits {
  (e: 'add-filter', filter: FilterCondition): void
  (e: 'remove-filter', filterId: string): void
  (e: 'clear-all-filters'): void
}

const emit = defineEmits<Emits>()

// Composables
const { t } = useI18n()

// Local state
const showAddFilterMenu = ref(false)
const newFilter = ref({
  field: '',
  operator: 'is' as any,
  value: '',
  value2: undefined,
})

// Computed properties
const fieldOptions = computed(() => {
  return props.availableFields.map((field) => ({
    title: field.title,
    key: field.key,
    type: field.type,
  }))
})

const currentFieldType = computed(() => {
  const field = props.availableFields.find(
    (f) => f.key === newFilter.value.field,
  )
  return field?.type || 'string'
})

const operatorOptions = computed(() => {
  const operators = props.getOperatorsForFieldType(currentFieldType.value)
  return operators.map((op) => ({
    text: props.getOperatorText(op),
    value: op,
  }))
})

const booleanOptions = computed(() => [
  { text: t('table.yes'), value: true },
  { text: t('table.no'), value: false },
])

const isDateOnlyFilterField = computed(() =>
  isDateLikeFieldType(currentFieldType.value),
)

const isBooleanFilterField = computed(() => currentFieldType.value === 'boolean')

const dateInputTypeForField = (t: string): 'date' | 'datetime-local' => {
  if (t === 'date-time' || t === 'datetime') return 'datetime-local'
  return 'date'
}

const value2InputType = computed(() => {
  const typ = currentFieldType.value
  if (['number', 'integer'].includes(typ)) return 'number'
  return 'text'
})

const isNewFilterValid = computed(() => {
  if (!newFilter.value.field) return false
  if (isDateOnlyFilterField.value) {
    const from = String(newFilter.value.value ?? '').trim()
    const to = String(newFilter.value.value2 ?? '').trim()
    return from !== '' || to !== ''
  }
  if (props.operatorNeedsValue(newFilter.value.operator)) {
    if (newFilter.value.value === '' || newFilter.value.value == null)
      return false
    if (props.operatorNeedsSecondValue(newFilter.value.operator)) {
      if (newFilter.value.value2 === '' || newFilter.value.value2 == null)
        return false
    }
  }
  return true
})

// Format a filter value for display (handles primitives and avoids [object Object] for objects)
const formatFilterValueForDisplay = (val: unknown): string => {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>
    return String(obj.title ?? obj.label ?? obj.name ?? obj.value ?? '')
  }
  return String(val)
}

// Methods
const getFilterDisplayText = (filter: FilterCondition): string => {
  const field = props.availableFields.find((f) => f.key === filter.field)
  const fieldTitle = field?.title || filter.field
  const operatorText = props.getOperatorText(filter.operator)

  if (filter.operator === 'has_any_value') {
    return `${fieldTitle} ${operatorText}`
  }

  if (field?.type === 'boolean') {
    const boolLabel =
      filter.value === true || filter.value === 'true'
        ? t('table.yes')
        : t('table.no')
    return `${fieldTitle}: ${boolLabel}`
  }

  if (
    filter.operator === 'is_between' &&
    field &&
    isDateLikeFieldType(field.type)
  ) {
    const from = formatFilterValueForDisplay(filter.value)
    const to = formatFilterValueForDisplay(filter.value2)
    if (from && to) {
      return `${fieldTitle}: ${from} – ${to}`
    }
    if (from) {
      return `${fieldTitle} ${t('table.filters.dateFrom')}: ${from}`
    }
    if (to) {
      return `${fieldTitle} ${t('table.filters.dateTo')}: ${to}`
    }
    return fieldTitle
  }

  if (filter.operator === 'is_between' && filter.value2 !== undefined) {
    return `${fieldTitle} ${operatorText} ${formatFilterValueForDisplay(filter.value)} ${t('table.filters.and').toLowerCase()} ${formatFilterValueForDisplay(filter.value2)}`
  }

  return `${fieldTitle} ${operatorText} ${formatFilterValueForDisplay(filter.value)}`
}

const handleNewFilterFieldChange = (newFieldKey: string) => {
  const field = props.availableFields.find((f) => f.key === newFieldKey)
  const fieldType = field?.type || 'string'

  if (isDateLikeFieldType(fieldType)) {
    newFilter.value.operator = 'is_between'
    newFilter.value.value = ''
    newFilter.value.value2 = ''
    return
  }

  const availableOperators = props.getOperatorsForFieldType(fieldType)
  newFilter.value.operator = availableOperators[0]
  newFilter.value.value = ''
  newFilter.value.value2 = undefined
}

const handleNewFilterOperatorChange = (newOperator: any) => {
  // Clear values if operator doesn't need them
  if (!props.operatorNeedsValue(newOperator)) {
    newFilter.value.value = ''
    newFilter.value.value2 = undefined
  } else if (!props.operatorNeedsSecondValue(newOperator)) {
    newFilter.value.value2 = undefined
  }
}

const applyNewFilter = () => {
  const op = isDateOnlyFilterField.value
    ? 'is_between'
    : (newFilter.value.operator as FilterOperator)

  // Normalize filter values based on field types (newFilter is a ref, so .value holds { field, operator, value, value2 })
  let value: string | number | boolean = newFilter.value.value
  let value2: string | number | undefined = newFilter.value.value2

  if (
    currentFieldType.value === 'number' ||
    currentFieldType.value === 'integer'
  ) {
    if (value !== '' && value != null) {
      value = Number(value)
    }
    if (value2 !== '' && value2 != null) {
      value2 = Number(value2)
    }
  } else if (currentFieldType.value === 'boolean') {
    if (value !== '' && value != null) {
      value = Boolean(value)
    }
  }

  const normalizedFilter: FilterCondition = {
    id: props.generateFilterId(),
    field: newFilter.value.field,
    operator: op,
    value,
    value2,
  }

  // Emit the filter
  emit('add-filter', normalizedFilter)

  // Reset form and close menu
  resetNewFilter()
  showAddFilterMenu.value = false
}

const cancelAddFilter = () => {
  resetNewFilter()
  showAddFilterMenu.value = false
}

const resetNewFilter = () => {
  const firstField = props.availableFields[0]
  if (firstField) {
    const dateLike = isDateLikeFieldType(firstField.type)
    newFilter.value = {
      field: firstField.key,
      operator: dateLike
        ? 'is_between'
        : props.getOperatorsForFieldType(firstField.type)[0],
      value: '',
      value2: dateLike ? '' : undefined,
    }
  }
}

const handleRemoveFilter = (filterId: string) => {
  emit('remove-filter', filterId)
}

const handleClearAllFilters = () => {
  emit('clear-all-filters')
}

// Initialize new filter form
watch(
  () => props.availableFields,
  (fields) => {
    const hasCurrentField = fields.some((f) => f.key === newFilter.value.field)
    if (fields.length > 0 && (!newFilter.value.field || !hasCurrentField)) {
      resetNewFilter()
    }
  },
  { immediate: true },
)
</script>

<style src="@/assets/styles/components/core/CoreFiltersPanel.css"></style>
