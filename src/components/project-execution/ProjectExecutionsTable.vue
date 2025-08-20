<template>
  <div class="table-wrapper">
    <div
      class="table-container"
      :class="{ 'fixed-width': useFixedWidth }"
    >
      <PDataTable
        :headers="headerExecutions"
        :items="processedExecutions"
        :showFooter="showFooter"
        :showHeaders="showHeaders"
        :class="['execution-table', { 'no-headers': !showHeaders }]"
        :key="tableKey"
      >
        <!-- createdAt -->
        <template #createdAt="{ item }">
          <div class="cell-content">
            <span>
              {{
                formatDateByTime
                  ? formatToHHmm(item.createdAt)
                  : new Date(item.createdAt).toISOString().split('T')[0]
              }}
            </span>
          </div>
        </template>

        <!-- finishedAt -->
        <template #finishedAt="{ item }">
          <div class="cell-content">
            <span>
              {{
                item.finishedAt
                  ? (formatDateByTime
                      ? formatToHHmm(item.finishedAt)
                      : new Date(item.finishedAt).toISOString().split('T')[0])
                  : '-'
              }}
            </span>
          </div>
        </template>

        <!-- userName -->
        <template #userName="{ item }">
          <div class="cell-content" v-tooltip.bottom="item.userName">
            <span>{{ item.userName || '-' }}</span>
          </div>
        </template>

        <!-- name -->
        <template #name="{ item }">
          <div class="cell-content" v-tooltip.bottom="item.name">
            <span>{{ item.name }}</span>
          </div>
        </template>

        <!-- description -->
        <template #description="{ item }">
          <div class="cell-content" v-tooltip.bottom="item.description">
            <span>{{ item.description }}</span>
          </div>
        </template>

        <!-- solver -->
        <template #solver="{ item }">
          <div class="cell-content" v-tooltip.bottom="getSolverName(item)">
            <span>{{ getSolverName(item) }}</span>
          </div>
        </template>

        <!-- timeLimit -->
        <template #timeLimit="{ item }" v-if="showTimeLimit">
          <div class="cell-content">
            <span>{{ getTimeLimit(item) }} sec</span>
          </div>
        </template>

        <!-- state -->
        <template #state="{ item }">
          <Tag
            :value="getStateInfo(item.state).code"
            class="text-xs"
            v-tooltip.bottom="getStateInfo(item.state).message"
            :style="getTagStyle(getStateInfo(item.state).color)"
          />
        </template>

        <!-- solution -->
        <template #solution="{ item }">
          <Tag
            :value="getSolutionInfo(item.solution_state).code"
            class="text-xs"
            v-tooltip.bottom="getSolutionInfo(item.solution_state).message"
            :style="getTagStyle(getSolutionInfo(item.solution_state).color)"
          />
        </template>

        <!-- excel -->
        <template #excel="{ item }">
          <i
            v-if="!item.isDownloading"
            class="mdi mdi-microsoft-excel cursor-pointer"
            @click="handleDownloadClick(item)"
          ></i>
          <ProgressSpinner
            v-else
            style="width:20px;height:20px"
            strokeWidth="4"
            animationDuration=".5s"
          />
        </template>

        <!-- actions -->
        <template #actions="{ item }">
          <span class="flex gap-2">
            <span>
              <i
                v-if="!loadingExecutions.has(item.id)"
                class="mdi mdi-tray-arrow-up cursor-pointer"
                @click="loadExecutionClick(item)"
              ></i>
              <ProgressSpinner
                v-else
                style="width:20px;height:20px"
                strokeWidth="4"
                animationDuration=".5s"
              />
            </span>
            <span>
              <i
                class="mdi mdi-trash-can-outline cursor-pointer"
                @click="deleteExecution(item)"
              ></i>
            </span>
          </span>
        </template>
      </PDataTable>
    </div>
  </div>
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
    @delete="confirmDeleteClick"
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

<script setup lang="ts">
import { inject } from 'vue';
import { useProjectExecutionsTable } from '@/composables/project-execution-table/useProjectExecutionsTable';
import { useI18n } from 'vue-i18n';
import { useGeneralStore } from '@/stores/general';

import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'

// Setup i18n
const { t } = useI18n();

// Get general store
const generalStore = useGeneralStore();

// Define props
const props = defineProps({
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
  useFixedWidth: {
    type: Boolean,
    default: true,
  },
  loadingExecutions: {
    type: Set,
    default: () => new Set(),
  },
});

// Define emits
const emit = defineEmits(['loadExecution', 'deleteExecution']);

// Inject snackbar function
const showSnackbar: (message: string, type: string) => void = inject('showSnackbar') as (message: string, type: string) => void;

// Get showTimeLimit setting from config
const showTimeLimit = generalStore.appConfig.parameters.showExtraProjectExecutionColumns.showTimeLimit;

// Use our composable with type assertion
const {
  openConfirmationDeleteModal,
  deletedItem,
  processedExecutions,
  headerExecutions,
  tableKey,
  addColgroup,
  loadExecution,
  deleteExecution,
  confirmDelete,
  cancelDelete,
  handleDownload,
  getStateInfo,
  getSolutionInfo,
  getSolverName,
  getTimeLimit,
} = useProjectExecutionsTable(props as any);

// Event handlers that use emits
const loadExecutionClick = (execution: any) => {
  emit('loadExecution', execution);
};

const confirmDeleteClick = () => {
  emit('deleteExecution', deletedItem.value);
  openConfirmationDeleteModal.value = false;
};

const handleDownloadClick = async (item: any) => {
  item.isDownloading = true;
  try {
    const result = await handleDownload(item);
    if (result && typeof result === 'object' && 'error' in result) {
      showSnackbar(t('inputOutputData.errorDownloadingExcel'), 'error');
    }
  } finally {
    item.isDownloading = false;
  }
};

// Utility function to format time as HH:mm
const formatToHHmm = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

// PrimeVue Tag no mapea colores arbitrarios en :severity. Forzamos estilos inline.
const getTagStyle = (color: string): Record<string, string> => ({
  backgroundColor: color,
  borderColor: color,
  color: '#ffffff'
})
</script>

<style scoped>
@import '@/assets/styles/components/project-execution/ProjectExecutionsTable.css';
</style>
