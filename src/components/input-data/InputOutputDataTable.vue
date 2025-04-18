<template>
  <div class="input-output-data-container">
    <!-- Alerts Section -->
    <div v-if="checksLaunched && checksFinished && (!data?.dataChecks || Object.keys(data.dataChecks).length === 0)" class="alert-section">
      <v-alert
        class="mb-3"
        color="green"
        elevation="2"
        icon="mdi-check"
        density="compact"
        style="font-size: 0.85rem !important"
      >
        {{ $t('inputOutputData.dataChecksPassedMessage') }}
      </v-alert>
    </div>

    <div v-if="checksLaunched && !checksFinished && !checksError" class="alert-section">
      <v-alert
        class="mb-3"
        color="blue"
        elevation="2"
        icon="mdi-alert"
        density="compact"
        style="font-size: 0.85rem !important"
      >
        <v-progress-circular
          indeterminate
          color="white"
          size="14"
          class="mr-2"
        ></v-progress-circular>
        {{ $t('inputOutputData.dataChecksLoadingMessage') }}
      </v-alert>
    </div>

    <div v-if="checksError" class="alert-section">
      <v-alert
        class="mb-3"
        color="error"
        elevation="2"
        icon="mdi-alert-circle"
        density="compact"
        style="font-size: 0.85rem !important"
      >
        {{ $t('inputOutputData.dataChecksFailedMessage') }}
      </v-alert>
    </div>

    <div v-if="data?.dataChecks && Object.keys(data.dataChecks).length > 0" class="alert-section">
      <v-alert
        :class="{ 'mb-3': !showDataChecksTable }"
        color="var(--secondary)"
        elevation="2"
        icon="mdi-alert"
        density="compact"
        style="font-size: 0.85rem !important"
      >
        {{
          type === 'instance'
            ? $t('inputOutputData.dataChecksInstanceMessage')
            : $t('inputOutputData.dataChecksSolutionMessage')
        }}
        <v-spacer></v-spacer>
        <v-btn
          text
          class="mt-2"
          @click="showDataChecksTable = !showDataChecksTable"
          style="font-size: 0.6rem !important"
        >
          {{
            showDataChecksTable
              ? $t('inputOutputData.hideDetails')
              : $t('inputOutputData.viewDetails')
          }}
        </v-btn>
      </v-alert>
    </div>

    <!-- Data Checks Table Section -->
    <div v-if="showDataChecksTable" class="data-checks-section">
      <MTabTable
        key="data-checks-tabs"
        class="mb-3"
        :tabsData="dataChecksTabsData"
        @update:selectedTab="handleDataChecksTabSelected"
      >
        <template #actions>
          <v-row class="d-flex mt-3">
            <v-spacer></v-spacer>
            <v-icon
              class="modal_icon_title mr-8"
              @click="showDataChecksTable = false"
              >mdi-close</v-icon
            >
          </v-row>
        </template>
        <template #table>
          <v-row class="mt-8" style="overflow-x: auto !important;">
            <MDataTable
              key="data-checks-table"
              class="data-checks-table"
              :items="dataChecksTableData"
              :headers="dataChecksHeaders"
              :options="{ density: 'compact' }"
            />
          </v-row>
        </template>
      </MTabTable>
    </div>

    <!-- Main Data Table Section -->
    <div class="main-table-section">
      <MTabTable
        :tabsData="tabsData"
        @update:selectedTab="handleTabSelected"
        :selectedTable="selectedTable"
      >
        <template #actions>
          <v-row class="mt-3">
            <v-col cols="10">
              <MFilterSearch
                :filters="filters"
                @reset="handleResetFilters"
                @search="handleSearch"
                @filter="handleFilters"
              />
            </v-col>
            <v-spacer></v-spacer>
            <v-col
              cols="2"
              style="margin: 0 !important; justify-content: end; display: flex"
            >
              <v-btn
                v-if="!canEdit"
                icon="mdi-microsoft-excel"
                class="mr-4"
                color="primary"
                density="compact"
                style="font-size: 0.7rem !important"
                @click="handleDownload()"
              ></v-btn>
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
            </v-col>
          </v-row>
        </template>
        <template #table>
          <v-row class="mt-8" style="overflow-x: auto !important;">
            <MDataTable
              :items="filteredDataTable"
              :headers="headers"
              :options="{ density: 'compact' }"
              :editionMode="editionMode"
              @create-item="createItem"
              @deleteItem="deleteItem"
            />
          </v-row>
          <v-row v-if="canCheckData" class="mt-5 mb-2 justify-center">
            <v-btn
              @click="emitCheckData()"
              variant="outlined"
              prepend-icon="mdi-play"
              :disabled="editionMode || (checksLaunched && !checksFinished) || checksError"
            >
              {{ $t('projectExecution.steps.step4.check') }}
            </v-btn>
          </v-row>
        </template>
      </MTabTable>
    </div>

    <!-- Modals -->
    <MBaseModal
      v-model="openConfirmationSaveModal"
      :closeOnOutsideClick="false"
      :title="$t('inputOutputData.saveChanges')"
      :buttons="[
        {
          text: $t('inputOutputData.save'),
          action: 'save',
          class: 'primary-btn',
        },
        {
          text: $t('inputOutputData.exitWithoutSaving'),
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
          <span>{{ $t('inputOutputData.savingMessage') }}</span>
        </v-row>
      </template>
    </MBaseModal>

    <MBaseModal
      v-model="openConfirmationDeleteModal"
      :closeOnOutsideClick="false"
      :title="$t('inputOutputData.deleteTitle')"
      :buttons="[
        {
          text: $t('inputOutputData.deleteButton'),
          action: 'delete',
          class: 'primary-btn',
        },
        {
          text: $t('inputOutputData.cancelButton'),
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
          <span>{{ $t('inputOutputData.deleteMessage') }}</span>
        </v-row>
      </template>
    </MBaseModal>
  </div>
</template>

<script>
import { useGeneralStore } from '@/stores/general'
import { inject } from 'vue'
import { LoadedExecution } from '@/models/LoadedExecution'
import useFilters from '@/utils/useFilters'

export default {
  emits: ['saveChanges', 'resolve'],
  components: {},
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
    canCheckData: {
      type: Boolean,
      required: false,
      default: false,
    },
    checksFinished: {
      type: Boolean,
      required: false,
      default: false,
    },
    checksError: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      generalStore: useGeneralStore(),
      showSnackbar: null,
      checksLaunched: false,
      selectedTable: null,
      checkSelectedTable: '',
      editionMode: false,
      openConfirmationSaveModal: false,
      openConfirmationDeleteModal: false,
      deletedIndexItem: null,
      data: null,
      formattedTableData: [],
      showDataChecksTable: false,
      searchText: '',
      filtersSelected: {},
      originalFilters: {},
      filters: {},
      resetPage: false,
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
    if (this.execution instanceof LoadedExecution) {
      this.selectedTable = this.execution.getSelectedTablePreference(this.type)
      this.handleTabSelected(this.selectedTable)
    }
  },
  watch: {
    selectedTable: {
      handler(newVal, oldVal) {
        if (newVal !== oldVal) {
          this.resetPage = true
        }
      },
    },
    showDataChecksTable: {
      handler() {
        if (!this.showDataChecksTable) {
          this.checkSelectedTable = ''
        } else {
          this.checkSelectedTable = this.dataChecksTabsData[0]?.value
        }
      },
    },
    execution: {
      handler() {
        const executionInstance = this.execution.experiment
          ? JSON.parse(JSON.stringify(this.execution.experiment[this.type]))
          : JSON.parse(JSON.stringify(this.execution[this.type]))
        this.data = executionInstance
        this.loadFilters()
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
            this.tableType,
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
            this.tableType,
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
    tableType() {
      return `${this.type}Schema`
    },
    checksTableType() {
      return `${this.type}ChecksSchema`
    },
    tabsData() {
      if (this.execution && this.data) {
        return this.generalStore.getTableDataNames(
          this.tableType,
          this.data.data,
        )
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
          ? this.generalStore.getTableHeadersData(
              this.tableType,
              this.selectedTable,
            )
          : this.generalStore.getConfigTableHeadersData()

          if (headers.length === 0) {
            const headers = this.generalStore.getHeadersFromData(
            this.data.data[this.selectedTable][0],
            )
            return headers
          } 

        return headers
      }
      return []
    },
    dataChecksTabsData() {
      if (this.data?.dataChecks) {
        return this.generalStore.getTableDataNames(
          this.checksTableType,
          this.data.dataChecks
        )
      }
      return []
    },
    dataChecksTableData() {
      if (this.data && this.checkSelectedTable) {
        if (Array.isArray(this.data.dataChecks[this.checkSelectedTable])) {
          return this.data.dataChecks[this.checkSelectedTable]
        } else {
          return this.generalStore.getConfigTableData(
            this.data.dataChecks[this.checkSelectedTable],
            this.checksTableType,
            this.checkSelectedTable,
          )
        }
      }
      return []
    },
    dataChecksHeaders() {
      if (this.data && this.checkSelectedTable) {
        const headers = Array.isArray(
          this.data.dataChecks[this.checkSelectedTable],
        )
          ? this.generalStore.getTableHeadersData(
              this.checksTableType,
              this.checkSelectedTable,
            )
          : this.generalStore.getConfigTableHeadersData()
        return headers
      }
      return []
    },
    filteredDataTable() {
      return useFilters(
        this.formattedTableData,
        this.searchText,
        this.filtersSelected[this.selectedTable],
      )
    },
  },
  methods: {
    async confirmDelete() {
      this.formattedTableData.splice(this.deletedIndexItem, 1)
      this.openConfirmationDeleteModal = false
    },
    async cancelDelete() {
      this.openConfirmationDeleteModal = false
      this.deletedItem = null
    },
    emitCheckData() {
      this.data.dataChecks = null
      this.checksLaunched = true
      this.$emit('check-data')
    },
    deleteItem(index) {
      this.openConfirmationDeleteModal = true
      this.deletedIndexItem = index
    },
    createItem() {
      this.formattedTableData.unshift({})
    },
    loadFilters() {
      this.originalFilters = this.getFilters()
      this.filters = JSON.parse(JSON.stringify(this.originalFilters))
      if (this.execution instanceof LoadedExecution) {
        this.filtersSelected = this.execution.getFiltersPreference(this.type)
      }

      if (!this.filtersSelected[this.selectedTable]) {
        this.filtersSelected[this.selectedTable] = {}
      }

      // Update the selected attribute in the filters computed property
      for (let key in this.filters) {
        if (this.filters.hasOwnProperty(key)) {
          this.filters[key].selected =
            this.filtersSelected[this.selectedTable].hasOwnProperty(key)
        }
      }
    },
    getFilters() {
      return this.execution instanceof LoadedExecution &&
        Array.isArray(this.data?.data[this.selectedTable])
        ? this.generalStore.getFilterNames(
            this.tableType,
            this.selectedTable,
            this.type,
          )
        : {}
    },
    handleTabSelected(newTab) {
      this.selectedTable = newTab
      this.loadFilters()

      if (this.execution instanceof LoadedExecution) {
        this.execution.setSelectedTablePreference(newTab, this.type)
        this.execution.setFiltersPreference(this.filtersSelected, this.type)
      }
    },
    handleDataChecksTabSelected(newTab) {
      this.checkSelectedTable = newTab
    },
    handleResetPage() {
      this.resetPage = false
    },
    openSaveModal() {
      this.openConfirmationSaveModal = true
    },
    saveChanges() {
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
    async handleDownload() {
      let instance = false
      let solution = false
      if (this.type === 'instance') {
        instance = true
      } else if (this.type === 'solution') {
        solution = true
      }
      const filename = this.execution.name.toLowerCase().replace(/ /g, '_')
      try {
        await this.execution.experiment.downloadExcel(
          filename,
          instance,
          solution,
        )
      } catch (error) {
        this.showSnackbar($t('inputOutputData.errorDownloadingExcel'), 'error')
      }
    },
    handleSearch(search) {
      this.searchText = search
    },
    handleFilters(filter) {
      try {
        const newFilters = {
          ...this.filtersSelected[this.selectedTable],
        }

        if (filter.value.length === 0) {
          if (newFilters.hasOwnProperty(filter.key)) {
            delete newFilters[filter.key]
          }
        } else {
          newFilters[filter.key] = {
            type: filter.type,
            value: filter.value,
          }
        }

        this.filtersSelected[this.selectedTable] = newFilters
        this.filtersSelected = { ...this.filtersSelected } // Create a new object
        if (this.execution instanceof LoadedExecution) {
          this.execution.setFiltersPreference(this.filtersSelected, this.type)
        }

        // Update the selected attribute in the filters computed property
        for (let key in this.filters) {
          if (this.filters.hasOwnProperty(key)) {
            this.filters[key].selected = newFilters.hasOwnProperty(key)

            // Update the checked attribute for each option in filters[key].options
            if (this.filters[key].options) {
              this.filters[key].options.forEach((option) => {
                option.checked =
                  newFilters.hasOwnProperty(key) &&
                  newFilters[key].value.includes(option.value)
              })
            }
          }
        }
      } catch (error) {
        console.error('An unexpected error occurred in handleFilters:', error)
      }
    },
    handleResetFilters() {
      // Reset filtersSelected to an empty object
      this.filtersSelected = {}

      // Set the filters in the execution method
      if (this.execution instanceof LoadedExecution) {
        this.execution.setFiltersPreference(this.filtersSelected, this.type)
      }
      // Reset filters to originalFilters
      this.filters = JSON.parse(JSON.stringify(this.originalFilters))
    },
  },
}
</script>

<style scoped>
@import '@/assets/styles/components/input-data/InputOutputDataTable.css';
</style>
