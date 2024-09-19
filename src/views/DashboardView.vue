<template>
  <div class="view-container">
    <div class="d-flex align-end">
      <MTitleView
        :icon="'mdi-table-arrow-left'"
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
    <DashboardMain
      v-if="
        selectedExecution &&
        selectedExecution.state == 1 &&
        selectedExecution.hasSolution()
      "
      :execution="selectedExecution"
    >
    </DashboardMain>
  </div>
</template>

<script>
import ExecutionInfoCard from '@/components/project-execution/ExecutionInfoCard.vue'
import ExecutionInfoMenu from '@/components/project-execution/ExecutionInfoMenu.vue'
import DashboardMain from '@/app/components/DashboardMain.vue'
import { useGeneralStore } from '@/stores/general'
import { inject } from 'vue'

export default {
  components: {
    ExecutionInfoCard,
    ExecutionInfoMenu,
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
