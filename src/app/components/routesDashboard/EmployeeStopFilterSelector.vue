<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MInputField } from 'mango-vue'
import type { EmployeeStop } from '@/app/composables/routesDashboard/useEmployeeMap'

const props = defineProps<{
  stops: EmployeeStop[]
  selected?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:selected', value: string | null): void
}>()

const { t } = useI18n()

// Initialize with prop value or default to 'all'
const internalSelected = ref<string | null>(props.selected || 'all')

const stopOptions = computed(() => [
  { title: t('employeesDashboard.filterSelector.all'), value: 'all' },
  ...props.stops.map(stop => ({
    title: `${t('employeesDashboard.filterSelector.stop')} ${stop.name}`,
    value: stop.id
  }))
])

// Watch for changes in the internal selection and emit to parent
watch(internalSelected, (newValue) => {
  emit('update:selected', newValue)
})

// Watch for changes in the prop and update internal state
watch(
  () => props.selected,
  (newValue) => {
    if (newValue !== internalSelected.value) {
      internalSelected.value = newValue || 'all'
    }
  }
)
</script>

<template>
  <div class="employee-stop-filter-selector">
    <MInputField
      v-model="internalSelected"
      :isSelect="true"
      :options="stopOptions"
      :title="t('employeesDashboard.filterSelector.label')"
      :placeholder="t('employeesDashboard.filterSelector.hint')"
      class="stop-filter-dropdown"
      density="comfortable"
      clearable
    />
  </div>
</template>

<style scoped>
.employee-stop-filter-selector {
  margin-top: 1.5rem;
}

.stop-filter-dropdown {
  width: 200px;
  height: 60px;
}
</style> 