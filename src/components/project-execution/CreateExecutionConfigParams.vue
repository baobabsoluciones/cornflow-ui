<template>
  <div>
    <div v-for="(field, index) in visibleFields" :key="index" style="width: 40%">
      <template v-if="field.type === 'boolean'">
        <v-switch
          v-model="fieldValues[field.key]"
          :label="$t(field.title || '')"
          color="primary"
          inset
          class="mt-4"
        />
      </template>
      <template v-else-if="field.type === 'text'">
        <MInputField
          class="mt-4"
          v-model="fieldValues[field.key]"
          :title="$t(field.title || '')"
          :placeholder="$t(field.placeholder || '')"
          type="text"
          :prependInnerIcon="field.icon || defaultIcon"
          @update:modelValue="handleFieldUpdate(field.key, $event)"
        />
      </template>
      <template v-else-if="field.type === 'date'">
        <v-text-field
          class="mt-4"
          v-model="fieldValues[field.key]"
          :label="$t(field.title || '')"
          type="date"
          variant="outlined"
          density="comfortable"
          :prepend-inner-icon="field.icon || defaultIcon"
          @update:modelValue="handleFieldUpdate(field.key, $event)"
        />
      </template>
      <template v-else-if="field.type === 'select'">
        <v-select
          class="mt-4"
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
          class="mt-4"
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
      fieldValues,
      handleFieldUpdate,
      defaultIcon,
      getFieldPlaceholder,
      getFieldSuffix,
    }
  },
}
</script>