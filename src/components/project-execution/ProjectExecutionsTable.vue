<template>
  <DataTable :headers="headerExecutions" :items="executionsByDate">
    <template v-slot:createdAt="{ item }">
      {{ new Date(item.createdAt).toISOString().split('T')[0] }}
    </template>
    <template v-slot:solver="{ item }">
      {{ item.config.solver }}
    </template>
    <template v-slot:solution="{ item }">
      <v-icon>
        {{
          item.message === 'The execution has been solved correctly.'
            ? 'mdi-check'
            : 'mdi-close'
        }}
      </v-icon>
    </template>
    <template v-slot:state="{ item }">
      <v-chip
        :color="
          item.state === 0 ? 'purple' : item.state === 1 ? 'green' : 'red'
        "
      >
        {{
          item.state === 0 ? 'Loading' : item.state === 1 ? 'Ready' : 'Error'
        }}
      </v-chip>
    </template>
    <template v-slot:excel="{ item }">
      <v-icon @click="console.log('descargar')">mdi-microsoft-excel</v-icon>
    </template>
    <template v-slot:actions="{ item }">
      <span>
        <v-icon class="mr-2" @click="loadExecution(item)"
          >mdi-tray-arrow-up</v-icon
        >
        <v-icon class="mr-2" @click="relaunchExecution(item)"
          >mdi-reload</v-icon
        >
        <v-icon @click="deleteExecution(item)">mdi-delete</v-icon>
      </span>
    </template>
  </DataTable>
</template>

<script>
import DataTable from '@/components/core/DataTable.vue'
import { useGeneralStore } from '@/stores/general'
import { inject } from 'vue'

export default {
  components: {
    DataTable,
  },
  props: {
    executionsByDate: {
      type: Array,
      required: true,
    },
  },
  data() {
    return {
      showSnackbar: null,
      headerExecutions: [
        { title: this.$t('executionTable.date'), value: 'createdAt' },
        { title: this.$t('executionTable.name'), value: 'name' },
        { title: this.$t('executionTable.description'), value: 'description' },
        { title: this.$t('executionTable.excel'), value: 'excel' },
        { title: this.$t('executionTable.status'), value: 'state' },
        { title: this.$t('executionTable.solver'), value: 'solver' },
        { title: this.$t('executionTable.solution'), value: 'solution' },
        { title: this.$t('executionTable.actions'), value: 'actions' },
      ],
      generalStore: useGeneralStore(),
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
  },
  methods: {
    async loadExecution(execution) {
      try {
        const loadedResult = await this.generalStore.fetchLoadedExecution(
          execution.id,
        )

        if (loadedResult) {
          this.showSnackbar('Ejecución cargada correctamente')
        } else {
          this.showSnackbar('Error al cargada la ejecución', 'error')
        }
      } catch (error) {
        this.showSnackbar('Error al cargada la ejecución', 'error')
      }
    },
    relaunchExecution(execution) {
      this.$emit('relaunchExecution', execution)
    },
    deleteExecution(execution) {
      this.$emit('deleteExecution', execution)
    },
  },
}
</script>
<style></style>
