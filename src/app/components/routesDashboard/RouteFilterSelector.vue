<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MInputField } from 'mango-vue'

const props = defineProps<{
  routes: Array<any>
  selected?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:selected', value: string | null): void
}>()

const { t } = useI18n()

// Initialize with prop value or default to 'all'
const internalSelected = ref<string | null>(props.selected || 'all')

const routeOptions = computed(() => [
  { title: t('routesDashboard.filterSelector.all'), value: 'all' },
  ...props.routes.map(route => ({
    title: `${t('routesDashboard.filterSelector.route')} ${route.cod_route}`,
    value: route.cod_route
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
  <div class="route-filter-selector">
    <MInputField
      v-model="internalSelected"
      :isSelect="true"
      :options="routeOptions"
      :title="t('routesDashboard.filterSelector.label')"
      :placeholder="t('routesDashboard.filterSelector.hint')"
      class="route-filter-dropdown"
      density="comfortable"
      clearable
    />
  </div>
</template>

<style scoped>
.route-filter-selector {
  margin-top: 1.5rem;
}

.route-filter-dropdown {
  width: 200px;
  height: 60px;
}
</style> 