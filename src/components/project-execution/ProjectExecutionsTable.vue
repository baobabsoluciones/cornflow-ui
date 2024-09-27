<template>
  <MDataTable
    :headers="headerExecutions"
    :items="executionsByDate"
    :showFooter="showFooter"
    :showHeaders="showHeaders"
  >
    <template v-slot:createdAt="{ item }">
      {{
        formatDateByTime
          ? item.time
          : new Date(item.createdAt).toISOString().split('T')[0]
      }}
    </template>
    <template v-slot:solver="{ item }">
      {{ item.config.solver }}
    </template>
    <template v-slot:state="{ item }">
      <v-chip size="x-small" :color="stateInfo[item.state].color" value="chip">
        {{ stateInfo[item.state].code }}
        <v-tooltip activator="parent" location="bottom">
          <div style="font-size: 11px">
            {{ stateInfo[item.state].message }}
          </div>
        </v-tooltip>
      </v-chip>
    </template>
    <template v-slot:solution="{ item }">
      <v-chip
        size="x-small"
        :color="item.solution_state.sol_code === 2 ? 'green' : 'red'"
        value="chip"
      >
        {{ solutionStateInfo[item.solution_state.status_code].code }}
        <v-tooltip activator="parent" location="bottom">
          <div style="font-size: 11px">
            {{ solutionStateInfo[item.solution_state.status_code].message }}
          </div>
        </v-tooltip>
      </v-chip>
    </template>
    <template v-slot:excel="{ item }">
      <v-icon size="small" @click="handleDownload(item)"
        >mdi-microsoft-excel</v-icon
      >
    </template>
    <template v-slot:actions="{ item }">
      <span>
        <v-icon size="small" class="mr-2" @click="loadExecution(item)"
          >mdi-tray-arrow-up</v-icon
        >
        <v-icon size="small" @click="deleteExecution(item)">mdi-delete</v-icon>
      </span>
    </template>
  </MDataTable>
  <MBaseModal
    v-model="openConfirmationDeleteModal"
    :closeOnOutsideClick="false"
    :title="$t('executionTable.deleteTitle')"
    :buttons="[
      {
        text: $t('executionTable.deleteButton'),
        action: 'delete',
        class: 'primary-btn',
      },
      {
        text: $t('executionTable.cancelButton'),
        action: 'cancel',
        class: 'secondary-btn',
      },
    ]"
    @delete="confirmDelete"
    @cancel="cancelDelete"
    @close="openConfirmationDeleteModal = false"
  >
    <template #content>
      <v-row class="d-flex justify-center pr-2 pl-2 pb-5 pt-3">
        <span> {{ $t('executionTable.deleteMessage') }}</span>
      </v-row>
    </template>
  </MBaseModal>
</template>

<script>
import { useGeneralStore } from '@/stores/general'
import { inject } from 'vue'

export default {
  components: {},
  props: {
    executionsByDate: {
      type: Array,
      required: true,
    },
    formatDateByTime: {
      type: Boolean,
      default: false,
    },
    showFooter: {
      type: Boolean,
      default: true,
    },
    showHeaders: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      showSnackbar: null,
      openConfirmationDeleteModal: false,
      deletedItem: null,
      generalStore: useGeneralStore(),
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
  },
  computed: {
    headerExecutions() {
      return [
        {
          title: this.$t('executionTable.date'),
          value: 'createdAt',
          width: '15%',
        },
        { title: this.$t('executionTable.name'), value: 'name', width: '20%' },
        {
          title: this.$t('executionTable.description'),
          value: 'description',
          width: '20%',
        },
        {
          title: this.$t('executionTable.excel'),
          value: 'excel',
          width: '8%',
        },
        {
          title: this.$t('executionTable.state'),
          value: 'state',
          width: '12%',
        },
        {
          title: this.$t('executionTable.solver'),
          value: 'solver',
          width: '13%',
        },
        {
          title: this.$t('executionTable.solution'),
          value: 'solution',
          width: '10%',
        },
        {
          title: this.$t('executionTable.actions'),
          value: 'actions',
          width: '10%',
        },
      ]
    },
    solutionStateInfo() {
      return this.generalStore.appConfig.parameters.logStates
    },
    stateInfo() {
      return {
        1: {
          color: 'green',
          message: this.$t('executionTable.executionSolvedCorrectly'),
          code: this.$t('executionTable.success'),
        },
        0: {
          color: 'purple',
          message: this.$t('executionTable.executionRunning'),
          code: this.$t('executionTable.loading'),
        },
        '-1': {
          color: 'red',
          message: this.$t('executionTable.executionError'),
          code: this.$t('executionTable.error'),
        },
        '-2': {
          color: 'red',
          message: this.$t('executionTable.executionStopped'),
          code: this.$t('executionTable.error'),
        },
        '-3': {
          color: 'red',
          message: this.$t('executionTable.executionNotStarted'),
          code: this.$t('executionTable.error'),
        },
        '-4': {
          color: 'red',
          message: this.$t('executionTable.executionNotRun'),
          code: this.$t('executionTable.error'),
        },
        '-5': {
          color: 'red',
          message: this.$t('executionTable.executionUnknownError'),
          code: this.$t('executionTable.error'),
        },
        '-6': {
          color: 'red',
          message: this.$t('executionTable.executionFailedSaving'),
          code: this.$t('executionTable.error'),
        },
        2: {
          color: 'green',
          message: this.$t('executionTable.executionLoadedManually'),
          code: this.$t('executionTable.success'),
        },
        '-7': {
          color: 'red',
          message: this.$t('executionTable.executionQueued'),
          code: this.$t('executionTable.loading'),
        },
      }
    },
  },
  methods: {
    async loadExecution(execution) {
      this.$emit('loadExecution', execution)
    },
    async deleteExecution(item) {
      this.deletedItem = item
      this.openConfirmationDeleteModal = true
    },
    async confirmDelete() {
      this.$emit('deleteExecution', this.deletedItem)
      this.openConfirmationDeleteModal = false
    },
    async cancelDelete() {
      this.openConfirmationDeleteModal = false
      this.deletedItem = null
    },
    async handleDownload(item) {
      try {
        await this.generalStore.getDataToDownload(item.id, true, true)
      } catch (error) {
        this.showSnackbar(
          this.$t('inputOutputData.errorDownloadingExcel'),
          'error',
        )
      }
    },
  },
}
</script>
<style scoped></style>
