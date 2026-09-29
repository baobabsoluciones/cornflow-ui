<template>
  <div :class="layout === 'grid' ? 'config-params-grid' : ''">
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
          :items="field.options || []"
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
import { computed, onMounted } from 'vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

export default {
  name: 'CreateExecutionTimeLimit',
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
     *   collapsing to a single column on narrow screens. Used where the fields sit in a
     *   column of their own (the load-instance step) and stacking wastes the width.
     */
    layout: {
      type: String,
      default: 'stack',
      validator: (value) => ['stack', 'grid'].includes(value),
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

      for (const field of configFields.value) {
        if (field.source === 'eParametros') {
          try {
            // Fetch value from eParametros table
            const value = await generalStore.fetchParametro(field.param)
            if (value !== undefined) {
              initialValues[field.key] =
                field.type === 'float' ? Number.parseFloat(value) : Number.parseInt(value, 10)
            }
          } catch (error) {
            console.error(`Error fetching parameter ${field.param}:`, error)
          }
        } else if (
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
    })

    return {
      configFields,
      visibleFields,
      fieldSpacing,
      fieldValues,
      handleFieldUpdate,
      defaultIcon,
      getFieldPlaceholder,
      getFieldSuffix,
    }
  },
}
</script>

<style scoped>
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