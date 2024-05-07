<template>
  <div class="view-container">
    <TitleView
      :icon="'mdi-table-arrow-right'"
      :title="title"
      :description="description"
    />
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
import TitleView from '@/components/core/TitleView.vue'
import ExecutionInfoCard from '@/components/project-execution/ExecutionInfoCard.vue'
import InputOutputDataTable from '@/components/input-data/InputOutputDataTable.vue'
import { useGeneralStore } from '@/stores/general'
import { inject } from 'vue'

export default {
  components: {
    TitleView,
    ExecutionInfoCard,
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
::v-deep .v-table {
  height: 55vh;
}
</style>
