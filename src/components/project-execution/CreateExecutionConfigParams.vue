<template>
  <div>
    <div v-for="(field, index) in configFields" :key="index" style="width: 40%">
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
          :placeholder="$t(field.placeholder || '')"
          :type="field.type === 'float' ? 'number' : 'number'"
          :step="field.type === 'float' ? '0.01' : '1'"
          :suffix="field.suffix ? $t(field.suffix) : ''"
          :prependInnerIcon="field.icon || defaultIcon"
          @update:modelValue="handleFieldUpdate(field.key, $event)"
        />
      </template>
    </div>
  </div>
</template>

<script>
import { computed, onMounted } from 'vue'
import { useGeneralStore } from '@/stores/general'

export default {
  name: 'CreateExecutionTimeLimit',
  props: {
    modelValue: {
      type: Object,
      required: true
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const generalStore = useGeneralStore()
    const defaultIcon = 'mdi-tune' // Default icon for parameters without specific icon

    const configFields = computed(() => {
      return generalStore.appConfig.parameters.configFields || []
    })

    const fieldValues = computed({
      get: () => props.modelValue.config || {},
      set: (newValue) => {
        const updatedModelValue = {
          ...props.modelValue,
          config: newValue
        }
        emit('update:modelValue', updatedModelValue)
      }
    })

    const handleFieldUpdate = (key, value) => {
      const newValues = { ...fieldValues.value }
      const field = configFields.value.find(f => f.key === key)
      
      // Parse the value based on field type
      if (field) {
        if (field.type === 'number') {
          newValues[key] = value ? parseInt(value, 10) : null
        } else if (field.type === 'float') {
          newValues[key] = value ? parseFloat(value) : null
        } else {
          newValues[key] = value
        }
      } else {
        newValues[key] = value
      }

      emit('update:modelValue', {
        ...props.modelValue,
        config: newValues
      })
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
              initialValues[field.key] = field.type === 'float' ? parseFloat(value) : parseInt(value, 10)
            }
          } catch (error) {
            console.error(`Error fetching parameter ${field.param}:`, error)
          }
        } else if (field.default !== undefined) {
          // Use default value if specified
          initialValues[field.key] = field.default
        }
      }

      emit('update:modelValue', {
        ...props.modelValue,
        config: initialValues
      })
    })

    return {
      configFields,
      fieldValues,
      handleFieldUpdate,
      defaultIcon
    }
  }
}
</script> 