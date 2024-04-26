<template>
  <div class="view-container">
    <TitleView
      :icon="'mdi-table-arrow-left'"
      :title="title"
      :description="description"
    />
    <ExecutionInfoCard :selectedExecution="selectedExecution">
    </ExecutionInfoCard>
    <InputDataTable
      class="mt-5"
      v-if="selectedExecution"
      :execution="selectedExecution"
    >
    </InputDataTable>
  </div>
</template>

<script>
import TitleView from '@/components/core/TitleView.vue'
import ExecutionInfoCard from '@/components/project-execution/ExecutionInfoCard.vue'
import InputDataTable from '@/components/core/input-data/InputDataTable.vue'
import { useGeneralStore } from '@/stores/general'
import { inject } from 'vue'

export default {
  components: {
    TitleView,
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
      return this.$t('inputData.title')
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

.selected-option {
  border: 2px solid var(--primary-variant);
}
</style>
