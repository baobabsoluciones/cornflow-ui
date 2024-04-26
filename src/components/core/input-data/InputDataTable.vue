<template>
  <div>
    <TabTable :tabsData="tabsData" @update:selectedTab="handleTabSelected">
      <template #actions>
        <v-row class="d-flex mt-3">
          <v-btn
            icon="mdi-filter-variant"
            color="primary"
            density="compact"
            style="font-size: 0.6rem !important"
          ></v-btn>
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
            :items="tableData"
            :headers="headers"
            :options="{ density: 'compact' }"
            :editionMode="editionMode"
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
      title="Save changes"
      :buttons="[
        {
          text: 'Save',
          action: 'save',
          class: 'primary-btn',
        },
        {
          text: 'Exit without saving',
          action: 'cancel',
          class: 'secondary-btn',
        },
      ]"
      @save="saveChanges"
      @cancel="cancelEdit"
      @close="cancelEdit"
    >
      <template #content>
        <v-row class="d-flex justify-center pr-2 pl-2 pb-5 pt-3">
          <span
            >Are you sure you want to save the changes? A new instance will be
            created with the new information and this will be the one added to
            the execution.</span
          >
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
      instance: null,
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
  },
  watch: {
    execution: {
      handler() {
        const executionInstance = this.execution.experiment
          ? JSON.parse(JSON.stringify(this.execution.experiment.instance))
          : JSON.parse(JSON.stringify(this.execution.instance))
        this.instance = executionInstance
      },
      deep: true,
    },
    tabsData: {
      handler() {
        this.selectedTable = this.tabsData[0]?.value
      },
      deep: true,
    },
  },
  mounted() {
    this.instance = this.execution.experiment
      ? JSON.parse(JSON.stringify(this.execution.experiment.instance))
      : JSON.parse(JSON.stringify(this.execution.instance))
    this.selectedTable = this.tabsData[0]?.value
  },
  methods: {},
  computed: {
    tabsData() {
      if (this.execution && this.instance) {
        return this.generalStore.getTableDataNames(
          'instance',
          this.instance.data,
        )
      }
      return []
    },
    tableData() {
      if (this.instance && this.selectedTable) {
        return this.instance.data[this.selectedTable]
      }
      return []
    },
    headers() {
      if (this.instance && this.selectedTable) {
        return this.generalStore.getTableHeadersData(
          'instance',
          this.selectedTable,
        )
      }
      return []
    },
  },
  methods: {
    handleTabSelected(newTab) {
      this.selectedTable = newTab
    },
    openSaveModal() {
      this.openConfirmationSaveModal = true
    },
    saveChanges() {
      this.$emit('save-changes', this.instance)
      this.editionMode = false
      this.openConfirmationSaveModal = false
    },
    cancelEdit() {
      this.instance = this.execution.experiment
        ? JSON.parse(JSON.stringify(this.execution.experiment.instance))
        : JSON.parse(JSON.stringify(this.execution.instance))
      this.editionMode = false
      this.openConfirmationSaveModal = false
    },
  },
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
