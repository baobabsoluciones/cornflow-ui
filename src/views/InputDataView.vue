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
    <InputDataTable
      class="mt-5"
      v-if="selectedExecution && selectedExecution.hasInstance()"
      :execution="selectedExecution"
    >
    </InputDataTable>
  </div>
</template>

<script>
import ExecutionInfoCard from '@/components/project-execution/ExecutionInfoCard.vue'
import ExecutionInfoMenu from '@/components/project-execution/ExecutionInfoMenu.vue'
import InputDataTable from '@/components/input-data/InputOutputDataTable.vue'
import { useGeneralStore } from '@/stores/general'
import { formatDate } from '@/utils/data_io'
import { inject } from 'vue'

export default {
  components: {
    ExecutionInfoCard,
    ExecutionInfoMenu,
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
  methods: {
    formatDate,
  },
}
</script>
<style scoped>
:deep(.v-table) {
  height: 55vh;
}
</style>
