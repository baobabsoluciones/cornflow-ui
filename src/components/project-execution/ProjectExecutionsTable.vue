<template>
  <div class="table-wrapper">
    <div
      class="table-container"
      :class="{ 'fixed-width': useFixedWidth, 'no-headers': !showHeaders }"
    >
      <MDataTable
        :headers="headerExecutions"
        :items="processedExecutions"
        :showFooter="showFooter"
        :showHeaders="showHeaders"
        :hideDefaultHeader="!showHeaders"
        class="execution-table"
        :key="tableKey"
      >
        <template v-slot:createdAt="{ item }">
          <div class="cell-content">
            <span>
              {{
                formatDateByTime ? formatToHHmm(item.createdAt) : new Date(item.createdAt).toISOString().split('T')[0]
              }}
            </span>
          </div>
        </template>
        <template v-slot:finishedAt="{ item }">
          <div class="cell-content">
            <span>
              {{ item.finishedAt ? (formatDateByTime ? formatToHHmm(item.finishedAt) : new Date(item.finishedAt).toISOString().split('T')[0]) : '-' }}
            </span>
          </div>
        </template>
        <template v-slot:userName="{ item }">
          <div class="cell-content">
            <span>{{ item.userName || '-' }}</span>
            <v-tooltip
              activator="parent"
              location="bottom"
              v-if="item.userName && item.userName.length > 15"
            >
              <span>{{ item.userName }}</span>
            </v-tooltip>
          </div>
        </template>
        <template v-slot:name="{ item }">
          <div class="cell-content">
            <span>{{ item.name }}</span>
            <v-tooltip
              activator="parent"
              location="bottom"
              v-if="item.name && item.name.length > 15"
            >
              <span>{{ item.name }}</span>
            </v-tooltip>
          </div>
        </template>
        <template v-slot:description="{ item }">
          <div class="cell-content">
            <span>{{ item.description }}</span>
            <v-tooltip
              activator="parent"
              location="bottom"
              v-if="item.description && item.description.length > 25"
            >
              <span>{{ item.description }}</span>
            </v-tooltip>
          </div>
        </template>
        <template v-slot:solver="{ item }">
          <div class="cell-content">
            <span>{{ getSolverName(item) }}</span>
            <v-tooltip
              activator="parent"
              location="bottom"
              v-if="getSolverName(item) && getSolverName(item).length > 15"
            >
              <span>{{ getSolverName(item) }}</span>
            </v-tooltip>
          </div>
        </template>
        <template v-slot:timeLimit="{ item }" v-if="showTimeLimit">
          <div class="cell-content">
            <span>{{ getTimeLimit(item) }} sec</span>
          </div>
        </template>
        <template v-slot:state="{ item }">
          <v-chip size="x-small" :color="getStateInfo(item.state).color" value="chip">
            {{ getStateInfo(item.state).code }}
            <v-tooltip activator="parent" location="bottom">
              <div style="font-size: 11px">
                {{ getStateInfo(item.state).message }}
              </div>
            </v-tooltip>
          </v-chip>
        </template>
        <template v-slot:solution="{ item }">
          <v-chip
            size="x-small"
            :color="getSolutionColor(item.solution_state)"
            value="chip"
          >
            {{ getSolutionCode(item.solution_state) }}
            <v-tooltip activator="parent" location="bottom">
              <div style="font-size: 11px">
                {{ getSolutionMessage(item.solution_state) }}
              </div>
            </v-tooltip>
          </v-chip>
        </template>
        <template v-slot:excel="{ item }">
          <v-icon 
            v-if="!item.isDownloading" 
            size="small" 
            @click="handleDownloadClick(item)"
          >
            mdi-microsoft-excel
          </v-icon>
          <v-progress-circular
            v-else
            indeterminate
            size="20"
            width="2"
            color="primary"
          ></v-progress-circular>
        </template>
        <template v-slot:actions="{ item }">
          <span>
            <span>
              <v-icon 
                v-if="!loadingExecutions.has(item.id)" 
                size="small" 
                class="mr-2" 
                @click="loadExecutionClick(item)"
              >
                mdi-tray-arrow-up
              </v-icon>
              <v-progress-circular
                v-else
                indeterminate
                size="20"
                width="2"
                color="primary"
                class="mr-2"
              ></v-progress-circular>
              <v-tooltip activator="parent" location="bottom">
                <span>
                  {{ $t('executionTable.loadExecution') }}
                </span>
              </v-tooltip>
            </span>
            <span>
              <v-icon size="small" @click="deleteExecution(item)"> mdi-delete </v-icon>
              <v-tooltip activator="parent" location="bottom">
                <span>
                  {{ $t('executionTable.deleteExecution') }}
                </span>
              </v-tooltip>
            </span>
          </span>
        </template>
      </MDataTable>
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
  getSolutionColor,
  getSolutionCode,
  getSolutionMessage,
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
function formatToHHmm(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}
</script>

<style scoped>
@import '@/assets/styles/components/project-execution/ProjectExecutionsTable.css';
</style>
