<template>
  <div>
    <TabTable :tabsData="tabsData" @update:selectedTab="handleTabSelected">
      <template #actions>
        <v-row class="d-flex mt-3">
          <MFilterSearch :filters="{
            name1: {
              type: 'range',
            },
            name2: {
              type: 'checkbox',
              options: [
                { checked: true, label: 'Label1', value: 'value1' },
                { checked: false, label: 'Label2', value: 'value2' },
              ],
            },
            name3: {
              type: 'daterange',
            },
          }" @search="handleSearch" @filter="handleFilters"/>
          <v-spacer></v-spacer>
          <v-btn
            v-if="canEdit && !editionMode"
            color="primary"
            icon="mdi-pencil"
            class="mr-3"
            density="compact"
            style="font-size: 0.6rem !important"
            @click="editionMode = true"
          >
          </v-btn>
          <v-btn
            v-if="canEdit && editionMode"
            color="primary"
            icon="mdi-content-save-edit"
            density="compact"
            style="font-size: 0.6rem !important"
            class="mr-3"
            @click="openSaveModal"
          >
          </v-btn>
          <v-btn
            icon="mdi-content-save-off"
            v-if="canEdit && editionMode"
            color="primary"
            class="mr-3"
            density="compact"
            style="font-size: 0.6rem !important"
            @click="cancelEdit"
          >
          </v-btn>
        </v-row>
      </template>
      <template #table="{ tabSelected }">
        <v-row class="mt-8">
          <DataTable
            :items="formattedTableData"
            :headers="headers"
            :options="{ density: 'compact' }"
            :editionMode="editionMode"
            @create-item="createItem"
            @deleteItem="deleteItem"
          />
        </v-row>
        <v-row class="mt-5 mb-2 justify-center" v-if="canResolve">
          <v-btn
            @click="$emit('resolve')"
            variant="outlined"
            prepend-icon="mdi-play"
          >
            {{ $t('projectExecution.steps.step6.resolve') }}
          </v-btn>
        </v-row>
      </template>
    </TabTable>
    <BaseModal
      v-model="openConfirmationSaveModal"
      :closeOnOutsideClick="false"
      :title="$t('inputData.saveChanges')"
      :buttons="[
        {
          text: $t('inputData.save'),
          action: 'save',
          class: 'primary-btn',
        },
        {
          text: $t('inputData.exitWithoutSaving'),
          action: 'cancel',
          class: 'secondary-btn',
        },
      ]"
      @save="saveChanges"
      @cancel="cancelEdit"
      @close="openConfirmationSaveModal = false"
    >
      <template #content>
        <v-row class="d-flex justify-center pr-2 pl-2 pb-5 pt-3">
          <span> {{ $t('inputData.savingMessage') }}</span>
        </v-row>
      </template>
    </BaseModal>
  </div>
</template>

<script>
import TabTable from '@/components/core/TabTable.vue'
import { useGeneralStore } from '@/stores/general'
import { inject } from 'vue'
import DataTable from '@/components/core/DataTable.vue'
import BaseModal from '@/components/core/BaseModal.vue'

export default {
  emits: ['saveChanges', 'resolve'],
  components: {
    TabTable,
    DataTable,
    BaseModal,
  },
  props: {
    execution: {
      type: Object,
      required: true,
    },
    type: {
      type: String,
      default: 'instance',
    },
    canEdit: {
      type: Boolean,
      required: false,
      default: false,
    },
    canResolve: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      generalStore: useGeneralStore(),
      showSnackbar: null,
      selectedTable: '',
      editionMode: false,
      openConfirmationSaveModal: false,
      data: null,
      formattedTableData: [],
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
  },
  watch: {
    execution: {
      handler() {
        const executionInstance = this.execution.experiment
          ? JSON.parse(JSON.stringify(this.execution.experiment[this.type]))
          : JSON.parse(JSON.stringify(this.execution[this.type]))
        this.data = executionInstance
      },
      deep: true,
    },
    formattedTableData: {
      handler(data, oldData) {
        let tableData = this.tableData
        if (
          data.length > 0 &&
          !Array.isArray(this.data.data[this.selectedTable])
        ) {
          tableData = this.generalStore.getConfigTableData(
            this.tableData,
            this.type,
            this.selectedTable,
          )
        }

        if (
          data.length > 0 &&
          JSON.stringify(data) !== JSON.stringify(tableData) &&
          !Array.isArray(this.data.data[this.selectedTable])
        ) {
          this.data.data[this.selectedTable] = data.reduce((obj, item) => {
            obj[item.key] = item.value
            return obj
          }, {})
        }
      },
      deep: true,
    },
    tableData: {
      handler(data, oldData) {
        if (!Array.isArray(data)) {
          this.formattedTableData = this.generalStore.getConfigTableData(
            data,
            this.type,
            this.selectedTable,
          )
        } else {
          this.formattedTableData = data
        }
      },
      deep: true,
    },
  },
  mounted() {
    this.data = this.execution.experiment
      ? JSON.parse(JSON.stringify(this.execution.experiment[this.type]))
      : JSON.parse(JSON.stringify(this.execution[this.type]))
  },
  computed: {
    tabsData() {
      if (this.execution && this.data) {
        return this.generalStore.getTableDataNames(this.type, this.data.data)
      }
      return []
    },
    tableData() {
      if (this.data && this.selectedTable) {
        return this.data.data[this.selectedTable]
      }
      return []
    },
    headers() {
      if (this.data && this.selectedTable) {
        const headers = Array.isArray(this.data.data[this.selectedTable])
          ? this.generalStore.getTableHeadersData(this.type, this.selectedTable)
          : this.generalStore.getConfigTableHeadersData()
        return headers
      }
      return []
    },
  },
  methods: {
    deleteItem(index) {
      this.formattedTableData.splice(index, 1)
    },
    createItem() {
      this.formattedTableData.unshift({})
    },
    handleTabSelected(newTab) {
      this.selectedTable = newTab
    },
    openSaveModal() {
      this.openConfirmationSaveModal = true
    },
    saveChanges() {
      this.updateEditedData()
      this.$emit('save-changes', this.data)
      this.editionMode = false
      this.openConfirmationSaveModal = false
    },
    cancelEdit() {
      this.data = this.execution.experiment
        ? JSON.parse(JSON.stringify(this.execution.experiment[this.type]))
        : JSON.parse(JSON.stringify(this.execution[this.type]))
      this.editionMode = false
      this.openConfirmationSaveModal = false
    },
    updateEditedData() {},
  },
}
</script>
<style scoped>
::v-deep .v-table {
  height: 55vh;
}
</style>
