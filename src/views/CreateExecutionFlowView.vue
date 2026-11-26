<template>
  <component :is="flow" :key="schema" />
</template>

<script setup lang="ts">
/**
 * The "create execution" route: the flow of the active DAG (`createExecution.component` of its
 * settings), or core's page. It is keyed by the DAG, so entering another DAG mounts that DAG's
 * flow; within a DAG, the route's keep-alive keeps the flow, with its draft, while the user visits
 * other views. See docs/create-execution-flows.md.
 */
import { computed } from 'vue'
import CreateExecutionView from '@cornflow-ui/core/views/CreateExecutionView.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import { createExecutionFlowComponent } from '@cornflow-ui/core/utils/createExecutionFlow'

defineOptions({ name: 'CreateExecutionFlowView' })

const store = useGeneralStore()
const schema = computed(() => store.getSchemaName)
const flow = computed(
  () =>
    createExecutionFlowComponent(
      (store.appConfig.parameters as Record<string, any>).createExecution
        ?.component,
    ) ?? CreateExecutionView,
)
</script>
