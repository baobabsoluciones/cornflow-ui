<template>
  <div class="view-container">
    <MTitleView
      :icon="'mdi-table-arrow-left'"
      :title="title"
      :description="description"
    />
    <ExecutionInfoCard :selectedExecution="selectedExecution">
    </ExecutionInfoCard>
    <InputDataTable
      class="mt-5"
      v-if="selectedExecution && selectedExecution.state == 1"
      :execution="selectedExecution"
    >
    </InputDataTable>
  </div>
</template>

<script>
import ExecutionInfoCard from '@/components/project-execution/ExecutionInfoCard.vue'
import InputDataTable from '@/components/input-data/InputOutputDataTable.vue'
import { useGeneralStore } from '@/stores/general'
import { inject } from 'vue'

export default {
  components: {
    ExecutionInfoCard,
    InputDataTable,
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
      return this.$t('inputOutputData.inputTitle')
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
