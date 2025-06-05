<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MInputField } from 'mango-vue'

const props = defineProps<{
  routes: Array<any>
}>()

const emit = defineEmits<{
  (e: 'update:selected', value: string | null): void
}>()

const { t } = useI18n()

const selected = ref<string | null>('all')

const routeOptions = computed(() => [
  { title: t('routesDashboard.filterSelector.all'), value: 'all' },
  ...props.routes.map(route => ({
    title: `${t('routesDashboard.filterSelector.route')} ${route.cod_route}`,
    value: route.cod_route
  }))
])

watch(selected, (val) => {
  emit('update:selected', val)
})
</script>

<template>
  <div class="route-filter-selector">
    <MInputField
      v-model="selected"
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