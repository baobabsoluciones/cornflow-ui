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
              :title="$t('table.filters.addCondition')"
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
                  :label="$t('table.filters.field')"
                  item-title="title"
                  item-value="key"
                  variant="outlined"
                  density="compact"
                  class="mb-2"
                  @update:model-value="handleNewFilterFieldChange"
                />

                <!-- Operator Selection -->
                <v-select
                  v-model="newFilter.operator"
                  :items="operatorOptions"
                  :label="$t('table.filters.operator')"
                  item-title="text"
                  item-value="value"
                  variant="outlined"
                  density="compact"
                  class="mb-2"
                  @update:model-value="handleNewFilterOperatorChange"
                />

                <!-- Value Input -->
                <div v-if="operatorNeedsValue(newFilter.operator)" class="mb-2">
                  <!-- String/Text input -->
                  <v-text-field
                    v-if="currentFieldType === 'string'"
                    v-model="newFilter.value"
                    :label="$t('table.filters.value')"
                    variant="outlined"
                    density="compact"
                  />

                  <!-- Number input -->
                  <v-text-field
                    v-else-if="['number', 'integer'].includes(currentFieldType)"
                    v-model="newFilter.value"
                    :label="$t('table.filters.value')"
                    type="number"
                    variant="outlined"
                    density="compact"
                  />

                  <!-- Boolean input -->
                  <v-select
                    v-else-if="currentFieldType === 'boolean'"
                    v-model="newFilter.value"
                    :items="booleanOptions"
                    :label="$t('table.filters.value')"
                    item-title="text"
                    item-value="value"
                    variant="outlined"
                    density="compact"
                  />

                  <!-- Second value for "between" operator -->
                  <v-text-field
                    v-if="operatorNeedsSecondValue(newFilter.operator)"
                    v-model="newFilter.value2"
                    :label="$t('table.filters.valueTo')"
                    :type="
                      ['number', 'integer'].includes(currentFieldType)
                        ? 'number'
                        : 'text'
                    "
                    variant="outlined"
                    density="compact"
                    class="mt-2"
                  />
                </div>

                <!-- Actions -->
                <div class="d-flex justify-end ga-2">
                  <CoreButton
                    :text="$t('table.filters.cancel')"
                    variant="text"
                    size="small"
                    @click="cancelAddFilter"
                  />
                  <CoreButton
                    :text="$t('table.filters.apply')"
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
} from '@/composables/core-table/useTableFilters'

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
const { t: $t } = useI18n()

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
  { text: $t('common.yes'), value: true },
  { text: $t('common.no'), value: false },
])

const isNewFilterValid = computed(() => {
  if (!newFilter.value.field) return false
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

// Methods
const getFilterDisplayText = (filter: FilterCondition): string => {
  const field = props.availableFields.find((f) => f.key === filter.field)
  const fieldTitle = field?.title || filter.field
  const operatorText = props.getOperatorText(filter.operator)

  if (filter.operator === 'has_any_value') {
    return `${fieldTitle} ${operatorText}`
  }

  if (filter.operator === 'is_between' && filter.value2 !== undefined) {
    return `${fieldTitle} ${operatorText} ${filter.value} ${$t('table.filters.and').toLowerCase()} ${filter.value2}`
  }

  return `${fieldTitle} ${operatorText} ${filter.value}`
}

const handleNewFilterFieldChange = (newFieldKey: string) => {
  const fieldType = currentFieldType.value
  const availableOperators = props.getOperatorsForFieldType(fieldType)

  // Reset operator and values when field changes
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
  // Normalize filter values based on field types
  const normalizedFilter = { ...newFilter.value }
  normalizedFilter.id = props.generateFilterId()

  // Convert values to appropriate types
  if (
    currentFieldType.value === 'number' ||
    currentFieldType.value === 'integer'
  ) {
    if (normalizedFilter.value !== '' && normalizedFilter.value != null) {
      normalizedFilter.value = Number(normalizedFilter.value)
    }
    if (normalizedFilter.value2 !== '' && normalizedFilter.value2 != null) {
      normalizedFilter.value2 = Number(normalizedFilter.value2)
    }
  } else if (currentFieldType.value === 'boolean') {
    if (normalizedFilter.value !== '' && normalizedFilter.value != null) {
      normalizedFilter.value = Boolean(normalizedFilter.value)
    }
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
    newFilter.value = {
      field: firstField.key,
      operator: props.getOperatorsForFieldType(firstField.type)[0],
      value: '',
      value2: undefined,
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
    if (fields.length > 0 && !newFilter.value.field) {
      resetNewFilter()
    }
  },
  { immediate: true },
)
</script>

<style src="@/assets/styles/components/core/CoreFiltersPanel.css"></style>
