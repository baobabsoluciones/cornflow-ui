<template>
  <v-text-field
    v-if="(header.type || 'string') !== 'boolean'"
    :model-value="modelValue"
    @update:model-value="
      (val) =>
        $emit(
          'update',
          header.type === 'number'
            ? val === ''
              ? undefined
              : Number(val)
            : val,
        )
    "
    :type="inputType"
    variant="outlined"
    density="compact"
    hide-details
    class="pending-changes-modal__input"
  />
  <v-switch
    v-else
    :model-value="!!modelValue"
    @update:model-value="(val) => $emit('update', val)"
    hide-details
    density="compact"
    color="primary"
    class="pending-changes-modal__switch"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Header {
  key: string
  title: string
  type?: string
}

const props = defineProps<{
  header: Header
  modelValue: any
}>()

defineEmits<{
  update: [value: any]
}>()

/** Get HTML input type for a header (date, datetime-local, time, number, text). */
const inputType = computed(() => {
  const t = props.header.type || 'string'
  if (t === 'date') return 'date'
  if (t === 'datetime') return 'datetime-local'
  if (t === 'time') return 'time'
  if (t === 'number') return 'number'
  return 'text'
})
</script>

<style scoped>
.pending-changes-modal__input {
  min-width: 80px;
  max-width: 160px;
}

.pending-changes-modal__input :deep(.v-field) {
  font-size: 0.8rem;
  border-radius: 6px;
}

.pending-changes-modal__switch {
  flex-shrink: 0;
}
</style>
