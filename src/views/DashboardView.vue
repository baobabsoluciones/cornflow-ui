<template>
  <div class="view-container">
    <MTitleView
      :icon="'mdi-view-dashboard'"
      :title="title"
      :description="description"
    />
    <ExecutionInfoCard :selectedExecution="selectedExecution">
    </ExecutionInfoCard>
    <DashboardMain
      v-if="selectedExecution && selectedExecution.state == 1"
      :execution="selectedExecution"
    >
    </DashboardMain>
  </div>
</template>

<script>
import ExecutionInfoCard from '@/components/project-execution/ExecutionInfoCard.vue'
import DashboardMain from '@/app/components/DashboardMain.vue'
import { useGeneralStore } from '@/stores/general'
import { inject } from 'vue'

export default {
  components: {
    ExecutionInfoCard,
    DashboardMain,
  },
  data() {
    return {
      generalStore: useGeneralStore(),
      showSnackbar: null,
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
  },
  methods: {},
  computed: {
    selectedExecution: {
      get() {
        return this.generalStore.selectedExecution
      },
      set(newValue) {
        this.generalStore.selectedExecution = newValue
      },
    },
    title() {
      return 'Dashboard'
    },
    description() {
      return this.selectedExecution ? this.selectedExecution.name : ''
    },
  },
  methods: {},
}
</script>
<style scoped>
::v-deep .v-table {
  height: 55vh;
}
</style>
