<template>
  <DataTable
    :headers="headerExecutions"
    :items="executionsByDate"
    :showFooter="showFooter"
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
    <template v-slot:solution="{ item }">
      <v-icon size="small">
        {{ item.state === 1 || item.state === 2 ? 'mdi-check' : 'mdi-close' }}
      </v-icon>
    </template>
    <template v-slot:state="{ item }">
      <v-chip size="x-small" :color="stateInfo[item.state].color" value="chip">
        {{ stateInfo[item.state].code }}
        <v-tooltip activator="parent" location="bottom">
          <div style="font-size: 11px">
            {{ item.message }}
          </div>
        </v-tooltip>
      </v-chip>
    </template>
    <template v-slot:excel="{ item }">
      <v-icon size="small" @click="console.log('descargar')"
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
  </DataTable>
  <BaseModal
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
  </BaseModal>
</template>

<script>
import DataTable from '@/components/core/DataTable.vue'
import { useGeneralStore } from '@/stores/general'
import { inject } from 'vue'
import BaseModal from '@/components/core/BaseModal.vue'

export default {
  components: {
    DataTable,
    BaseModal,
  },
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
  },
  data() {
    return {
      showSnackbar: null,
      openConfirmationDeleteModal: false,
      deletedItem: null,
      headerExecutions: [
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
          title: this.$t('executionTable.status'),
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
      ],
      generalStore: useGeneralStore(),
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
  },
  computed: {
    stateInfo() {
      return {
        1: {
          color: 'green',
          message: 'The execution has been solved correctly.',
          code: 'Success',
        },
        0: {
          color: 'purple',
          message: 'The execution is currently running.',
          code: 'Loading',
        },
        '-1': {
          color: 'red',
          message: 'The execution has found an error.',
          code: 'Error',
        },
        '-2': {
          color: 'red',
          message: 'The execution has stopped running.',
          code: 'Error',
        },
        '-3': {
          color: 'red',
          message: "The execution couldn't start running.",
          code: 'Error',
        },
        '-4': {
          color: 'red',
          message: "The execution wasn't run by user choice.",
          code: 'Error',
        },
        '-5': {
          color: 'red',
          message: 'The execution has an unknown error.',
          code: 'Error',
        },
        '-6': {
          color: 'red',
          message: 'The execution executed ok but failed while saving it.',
          code: 'Error',
        },
        2: {
          color: 'green',
          message: 'The execution was loaded manually.',
          code: 'Success',
        },
        '-7': {
          color: 'red',
          message: 'The execution is currently queued.',
          code: 'Loading',
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
    },
    async cancelDelete() {
      this.openConfirmationDeleteModal = false
      this.deletedItem = null
    },
  },
}
</script>
<style></style>
