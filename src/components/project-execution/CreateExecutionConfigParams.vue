<template>
  <!-- One row per field: the name on the left and the input on the right. -->
  <div v-if="layout === 'form'" class="config-form">
    <div
      v-for="field in visibleFields"
      :key="field.key"
      class="config-form__row"
      :data-testid="`config-field-${field.key}`"
    >
      <div class="config-form__label">
        <span>{{ $t(field.title || '') }}</span>
        <span v-if="field.source" class="config-form__source">{{
          $t('configParams.fromFile')
        }}</span>
      </div>
      <div class="config-form__control">
        <v-switch
          v-if="field.type === 'boolean'"
          :model-value="fieldValues[field.key]"
          color="primary"
          inset
          hide-details
          @update:model-value="handleFieldUpdate(field.key, $event)"
        />
        <OptionCards
          v-else-if="field.type === 'select' && showsAsCards(field)"
          :model-value="fieldValues[field.key]"
          :options="cardOptions(field)"
          :label="$t(field.title || '')"
          @update:model-value="handleFieldUpdate(field.key, $event)"
        />
        <v-select
          v-else-if="field.type === 'select'"
          class="config-form__input"
          :model-value="fieldValues[field.key]"
          :items="optionsOf(field)"
          item-title="label"
          item-value="value"
          :prepend-inner-icon="field.icon || defaultIcon"
          variant="outlined"
          density="comfortable"
          hide-details
          @update:model-value="handleFieldUpdate(field.key, $event)"
        />
        <v-text-field
          v-else
          class="config-form__input"
          :model-value="fieldValues[field.key]"
          :type="inputTypeOf(field)"
          :step="stepOf(field)"
          :placeholder="field.type === 'date' ? undefined : $t(getFieldPlaceholder(field))"
          :suffix="getFieldSuffix(field) ? $t(getFieldSuffix(field)) : undefined"
          :prepend-inner-icon="field.type === 'date' ? undefined : field.icon || defaultIcon"
          variant="outlined"
          density="comfortable"
          hide-details
          @update:model-value="handleFieldUpdate(field.key, $event)"
        />
      </div>
    </div>
  </div>
  <div v-else :class="layout === 'grid' ? 'config-params-grid' : ''">
    <div
      v-for="(field, index) in visibleFields"
      :key="index"
      :style="layout === 'grid' ? undefined : { width: '40%' }"
    >
      <template v-if="field.type === 'boolean'">
        <v-switch
          v-model="fieldValues[field.key]"
          :label="$t(field.title || '')"
          color="primary"
          inset
          :class="fieldSpacing"
        />
      </template>
      <!-- A date is the same field as a text one with a native date input; sharing the
           branch keeps its label above the box like every other parameter, instead of
           notched into the border as a bare v-text-field would render it. -->
      <template v-else-if="field.type === 'text' || field.type === 'date'">
        <MInputField
          :class="fieldSpacing"
          v-model="fieldValues[field.key]"
          :title="$t(field.title || '')"
          :placeholder="field.placeholder ? $t(field.placeholder) : ''"
          :type="field.type === 'date' ? 'date' : 'text'"
          :prependInnerIcon="field.icon || defaultIcon"
          @update:modelValue="handleFieldUpdate(field.key, $event)"
        />
      </template>
      <template v-else-if="field.type === 'select'">
        <v-select
          :class="fieldSpacing"
          v-model="fieldValues[field.key]"
          :label="$t(field.title || '')"
          :items="optionsOf(field)"
          item-title="label"
          item-value="value"
          :prepend-inner-icon="field.icon || defaultIcon"
          @update:modelValue="handleFieldUpdate(field.key, $event)"
        />
      </template>
      <template v-else>
        <MInputField
          :class="fieldSpacing"
          v-model="fieldValues[field.key]"
          :title="$t(field.title || '')"
          :placeholder="$t(getFieldPlaceholder(field))"
          :type="field.type === 'float' ? 'number' : 'number'"
          :step="field.type === 'float' ? '0.01' : '1'"
          :suffix="$t(getFieldSuffix(field))"
          :prependInnerIcon="field.icon || defaultIcon"
          @update:modelValue="handleFieldUpdate(field.key, $event)"
        />
      </template>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, ref, watch } from 'vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import OptionCards from '@cornflow-ui/core/components/core/OptionCards.vue'

/** Most options a select shows as cards in the form layout; with more it is a dropdown. */
const MAX_CARD_OPTIONS = 3

export default {
  name: 'CreateExecutionTimeLimit',
  components: { OptionCards },
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
    /**
     * Which config fields this instance renders:
     * - 'preEtl'   only the ones the schema marked `pre_etl: true` (the step that runs
     *              before the instance is loaded, because the ETL filters with them).
     * - 'standard' everything else (the usual execution-parameters step).
     * - 'all'      the whole set, the behaviour before the pre-ETL step existed.
     *
     * Defaulting to 'all' keeps every deployment that renders this component directly
     * working unchanged.
     */
    scope: {
      type: String,
      default: 'all',
      validator: (value) => ['all', 'preEtl', 'standard'].includes(value),
    },
    /**
     * - 'stack' (default) keeps the historical look: one field per row at 40% width.
     * - 'grid' lays them out two per row, each filling its half, wrapping as needed and
     *   collapsing to a single column on narrow screens.
     * - 'form' gives each field a row with its name on the left, as the load-instance and
     *   parameters steps show them. A select with few options shows them as cards, and a
     *   field read from the uploaded file says so.
     */
    layout: {
      type: String,
      default: 'stack',
      validator: (value) => ['stack', 'grid', 'form'].includes(value),
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const generalStore = useGeneralStore()
    const defaultIcon = 'mdi-tune' // Default icon for parameters without specific icon

    const configFields = computed(() => {
      return generalStore.appConfig.parameters.configFields || []
    })

    // Only the rendered subset changes with `scope`. `configFields` stays whole on
    // purpose: onMounted seeds defaults for every field, so a config parameter still
    // gets its default even when no step on screen shows it.
    // In the grid the gap does the spacing, so the per-field top margin would only push
    // the first row away from the heading.
    const fieldSpacing = computed(() => (props.layout === 'grid' ? '' : 'mt-4'))

    const visibleFields = computed(() => {
      if (props.scope === 'preEtl') {
        return configFields.value.filter((field) => field.preEtl === true)
      }
      if (props.scope === 'standard') {
        return configFields.value.filter((field) => field.preEtl !== true)
      }
      return configFields.value
    })

    // Options of the fields fed by a frontend-automation table (`joinFrom`), by field key.
    const tableOptions = ref({})

    const optionsOf = (field) =>
      field.joinFrom ? tableOptions.value[field.key] || [] : field.options || []

    // The fields with a table may arrive with the schema, and the frontend-automation tables
    // after the configurations load: their options are asked again when either changes.
    const tableSourcesSignature = computed(() => {
      const fields = visibleFields.value
        .filter((field) => field.joinFrom)
        .map((field) => `${field.key}=${field.joinFrom}`)
      const tables = Object.keys(generalStore.getConfigurations?.masterData ?? {})
      return `${fields.join('|')}#${tables.length}`
    })

    watch(tableSourcesSignature, () => loadTableOptions())

    const showsAsCards = (field) => {
      const count = optionsOf(field).length
      return count > 0 && count <= MAX_CARD_OPTIONS
    }

    const cardOptions = (field) =>
      optionsOf(field).map((option) => ({ value: option.value, title: option.label }))

    const inputTypeOf = (field) => {
      if (field.type === 'date') return 'date'
      if (field.type === 'number' || field.type === 'float') return 'number'
      return 'text'
    }

    const stepOf = (field) => {
      if (field.type === 'float') return '0.01'
      if (field.type === 'number') return '1'
      return undefined
    }

    /** Loads the options of the fields on screen fed by a frontend-automation table. */
    const loadTableOptions = async () => {
      const fields = visibleFields.value.filter((field) => field.joinFrom)
      await Promise.all(
        fields.map(async (field) => {
          const options = await generalStore.fetchTableOptions(field.joinFrom)
          tableOptions.value = {
            ...tableOptions.value,
            [field.key]: options.map((option) => ({
              value: option.value,
              label: option.title,
            })),
          }
        }),
      )
    }

    const fieldValues = computed({
      get: () => props.modelValue.config || {},
      set: (newValue) => {
        const updatedModelValue = {
          ...props.modelValue,
          config: newValue,
        }
        emit('update:modelValue', updatedModelValue)
      },
    })

    const handleFieldUpdate = (key, value) => {
      const newValues = { ...fieldValues.value }
      const field = configFields.value.find((f) => f.key === key)

      // Parse the value based on field type
      if (field) {
        if (field.type === 'number') {
          newValues[key] = value ? Number.parseInt(value, 10) : null
        } else if (field.type === 'float') {
          newValues[key] = value ? Number.parseFloat(value) : null
        } else {
          newValues[key] = value
        }
      } else {
        newValues[key] = value
      }

      emit('update:modelValue', {
        ...props.modelValue,
        config: newValues,
      })
    }

    const isTimeLimitField = (field) =>
      String(field?.key || '').toLowerCase() === 'timelimit'

    const shouldUseMinutesForTimeLimit = (field) =>
      isTimeLimitField(field) && field?.minutes === true

    const getFieldPlaceholder = (field) => {
      if (shouldUseMinutesForTimeLimit(field)) {
        return 'configParams.timeLimitPlaceholderMinutes'
      }
      return field.placeholder || ''
    }

    const getFieldSuffix = (field) => {
      if (shouldUseMinutesForTimeLimit(field)) {
        return 'configParams.minutesSuffix'
      }
      return field.suffix || ''
    }

    // Initialize field values based on their configuration
    onMounted(async () => {
      const initialValues = { ...fieldValues.value }

      // A field with a `source` gets its value from the loaded instance (the wizard reads it
      // when the data is loaded); until then, and when the file does not have it, its
      // default applies like any other field's.
      for (const field of configFields.value) {
        if (
          field.default !== undefined &&
          initialValues[field.key] === undefined
        ) {
          // Seed the default only where nothing has been set yet. Two instances of this
          // component can now mount in one wizard run (the pre-ETL step and the regular
          // one); without this guard the second mount would reset a pre-ETL value the
          // user already typed back to its schema default. Same for edit mode, where the
          // config comes from the execution being edited.
          initialValues[field.key] = field.default
        }
      }

      emit('update:modelValue', {
        ...props.modelValue,
        config: initialValues,
      })

      await loadTableOptions()
    })

    return {
      configFields,
      visibleFields,
      fieldSpacing,
      fieldValues,
      optionsOf,
      showsAsCards,
      cardOptions,
      inputTypeOf,
      stepOf,
      handleFieldUpdate,
      defaultIcon,
      getFieldPlaceholder,
      getFieldSuffix,
    }
  },
}
</script>

<style scoped>
.config-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.config-form__row {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
}

.config-form__label {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  font-size: 0.9375rem;
  color: var(--subtitle);
}

.config-form__source {
  padding: 1px 8px;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--primary) 10%, #fff);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--primary);
}

.config-form__input {
  max-width: 420px;
}

.config-form__input :deep(.v-field) {
  border-radius: 10px;
}

@media (max-width: 700px) {
  .config-form__row {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
}

/* Two per row, wrapping on their own: three fields give a row of two and a row of one,
   which is what the last one filling only its half looks like. */
.config-params-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
  align-items: start;
}

@media (max-width: 599px) {
  .config-params-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>