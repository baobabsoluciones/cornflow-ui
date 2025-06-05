<template>
  <div class="view-container">
    <div class="d-flex align-end">
      <MTitleView
        :icon="'mdi-routes'"
        :title="title"
        :description="description"
      />
      <ExecutionInfoMenu
        v-if="selectedExecution"
        :selectedExecution="selectedExecution"
      />
    </div>
    <ExecutionInfoCard :selectedExecution="selectedExecution">
    </ExecutionInfoCard>
    <div v-if="selectedExecution">
      <RouteFilterSelector />
      <div class="routes-dashboard-layout">
        <div class="routes-dashboard-map">
          <RouteMap />
        </div>
        <div class="routes-dashboard-info">
          <RouteGlobalInfo />
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
import { computed, inject } from 'vue'
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
const selectedRoute = computed(() => null)

const title = computed(() => t('routes.title'))
const description = computed(() => selectedExecution.value ? selectedExecution.value.name : '')
</script>

<style scoped>
.routes-dashboard-layout {
  display: flex;
  flex-direction: row;
  gap: 2rem;
}
.routes-dashboard-map {
  flex: 2;
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