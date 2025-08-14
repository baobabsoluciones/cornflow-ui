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
    <ExecutionInfoCard
      :selectedExecution="selectedExecution"
      :type="'solution'"
    >
    </ExecutionInfoCard>
    <InputOutputDataTable
      class="mt-5"
      v-if="selectedExecution && selectedExecution.hasSolution()"
      :type="'solution'"
      :execution="selectedExecution"
    >
    </InputOutputDataTable>
  </div>
</template>

<script>
import ExecutionInfoCard from '@/components/project-execution/ExecutionInfoCard.vue'
import ExecutionInfoMenu from '@/components/project-execution/ExecutionInfoMenu.vue'
import InputOutputDataTable from '@/components/input-data/InputOutputDataTable.vue'
import { useGeneralStore } from '@/stores/general'
import { inject } from 'vue'

export default {
  components: {
    ExecutionInfoCard,
    ExecutionInfoMenu,
    InputOutputDataTable,
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
    hasSolution: {
      get() {
        return this.selectedExecution.hasSolution()
      },
    },
    title() {
      return this.$t('inputOutputData.outputTitle')
    },
    description() {
      return this.selectedExecution ? this.selectedExecution.name : ''
    },
  },
  methods: {},
}
</script>
<style scoped>
:deep(.v-table) {
  height: 55vh;
}
</style>
