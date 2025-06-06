<template>
  <div class="view-container">
    <div class="d-flex align-end justify-start mb-10">
      <MTitleView
        :icon="'mdi-routes'"
        :title="title"
        :description="description"
      />
      <ExecutionInfoMenu
        v-if="selectedExecution"
        :selectedExecution="selectedExecution"
      />
      <RouteFilterSelector v-if="selectedExecution" class="ml-10" :routes="routes" v-model:selected="selectedRoute" />

    </div>
    <ExecutionInfoCard :selectedExecution="selectedExecution">
    </ExecutionInfoCard>
    <div v-if="selectedExecution">
      <div class="routes-dashboard-layout">
        <div class="routes-dashboard-map">
          <RouteMap
            :routes="enrichedRoutes"
            :selectedRoute="selectedRoute"
            @update:selected="selectedRoute = $event"
          />
        </div>
        <div class="routes-dashboard-info">
          <RouteGlobalInfo :selectedRoute="selectedRoute" :routes="routes" />
        </div>
      </div>
      <div class="routes-dashboard-bottom">
        <RouteStopsHorizontal v-if="selectedRoute" />
        <AllRoutesHorizontal v-else />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import RouteFilterSelector from '../components/routesDashboard/RouteFilterSelector.vue'
import RouteMap from '../components/routesDashboard/RouteMap.vue'
import RouteGlobalInfo from '../components/routesDashboard/RouteGlobalInfo.vue'
import RouteStopsHorizontal from '../components/routesDashboard/RouteStopsHorizontal.vue'
import AllRoutesHorizontal from '../components/routesDashboard/AllRoutesHorizontal.vue'
import ExecutionInfoCard from '@/components/project-execution/ExecutionInfoCard.vue'
import ExecutionInfoMenu from '@/components/project-execution/ExecutionInfoMenu.vue'
import { useGeneralStore } from '@/stores/general'

const generalStore = useGeneralStore()
const showSnackbar = inject('showSnackbar')
const { t } = useI18n()

const selectedExecution = computed(() => generalStore.selectedExecution)
const selectedRoute = ref<string | null>('all')

const enrichedRoutes = computed(() => selectedExecution.value?.experiment?.getEnrichedRoutes() || [])

const routes = computed(() => {
  const solution = selectedExecution.value?.experiment?.solution?.data
  return solution?.resume_routes || []
})

const title = computed(() => t('routes.title'))
const description = computed(() => selectedExecution.value ? selectedExecution.value.name : '')
</script>

<style scoped>
.routes-dashboard-layout {
  display: flex;
  flex-direction: row;
  gap: 2rem;
  height: 400px;
  min-height: 400px;
}
.routes-dashboard-map {
  flex: 1;
  height: 100%;
  min-height: 400px;
}
.routes-dashboard-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.routes-dashboard-bottom {
  margin-top: 2rem;
}
</style> 