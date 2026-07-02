<template>
  <div class="table-wrapper">
    <div
      class="table-container execution-scroll-sync"
      :class="{ 'fixed-width': useFixedWidth, 'no-headers': !showHeaders }"
      @scroll="syncHorizontalScroll"
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
                formatDateByTime
                  ? formatToHHmm(item.createdAt)
                  : new Date(item.createdAt).toISOString().split('T')[0]
              }}
            </span>
          </div>
        </template>
        <template v-slot:finishedAt="{ item }">
          <div class="cell-content">
            <span>
              {{
                item.finishedAt
                  ? formatDateByTime
                    ? formatToHHmm(item.finishedAt)
                    : new Date(item.finishedAt).toISOString().split('T')[0]
                  : '-'
              }}
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
        <template v-slot:userFullName="{ item }">
          <div class="cell-content">
            <span>{{ item.userFullName || '-' }}</span>
            <v-tooltip
              activator="parent"
              location="bottom"
              v-if="item.userFullName && item.userFullName.length > 15"
            >
              <span>{{ item.userFullName }}</span>
            </v-tooltip>
          </div>
        </template>
        <template v-slot:name="{ item }">
          <div class="cell-content name-cell">
            <v-chip
              v-if="isLatestPlan(item.id)"
              size="x-small"
              color="primary"
              variant="flat"
              class="latest-plan-chip mr-2"
            >
              <v-icon size="12" start>mdi-star</v-icon>
              {{ t('latestPlan.chip.current') }}
            </v-chip>
            <v-chip
              v-if="(item.config as any)?.replanning === true"
              size="x-small"
              color="secondary"
              variant="tonal"
              class="replanning-chip mr-2"
            >
              <v-icon size="12" start>mdi-refresh</v-icon>
              {{ t('executionTable.replanning') }}
            </v-chip>
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
            <span>
              {{ getTimeLimit(item) }}
              {{ t(getTimeLimitDisplayUnitI18nKey()) }}
            </span>
          </div>
        </template>
        <template v-slot:state="{ item }">
          <v-chip
            size="x-small"
            :color="getStateInfo(item.state).color"
            value="chip"
          >
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
            :color="getSolutionInfo(item.solution_state).color"
            value="chip"
          >
            {{ getSolutionInfo(item.solution_state).code }}
            <v-tooltip activator="parent" location="bottom">
              <div style="font-size: 11px">
                {{ getSolutionInfo(item.solution_state).message }}
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
          <span class="actions-container">
            <!-- Load execution -->
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
                  {{ t('executionTable.loadExecution') }}
                </span>
              </v-tooltip>
            </span>

            <!-- Set as latest plan (only if feature is available and execution is finished) -->
            <span
              v-if="
                isSetLatestPlanAvailable &&
                canSetAsLatestPlan(item.state) &&
                !isLatestPlan(item.id)
              "
            >
              <v-icon
                size="small"
                class="mr-2 set-latest-icon"
                @click="openSetLatestPlanModal(item)"
              >
                mdi-star-outline
              </v-icon>
              <v-tooltip activator="parent" location="bottom">
                <span>
                  {{ t('latestPlan.actions.setAsCurrent') }}
                </span>
              </v-tooltip>
            </span>

            <!-- Already latest plan indicator -->
            <span v-if="isLatestPlan(item.id)">
              <v-icon
                size="small"
                class="mr-2 current-latest-icon"
                color="primary"
              >
                mdi-star
              </v-icon>
              <v-tooltip activator="parent" location="bottom">
                <span>
                  {{ t('latestPlan.actions.isCurrentPlan') }}
                </span>
              </v-tooltip>
            </span>

            <!-- Delete execution -->
            <span>
              <v-icon size="small" @click="deleteExecution(item)">
                mdi-delete
              </v-icon>
              <v-tooltip activator="parent" location="bottom">
                <span>
                  {{ t('executionTable.deleteExecution') }}
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
    :title="t('executionTable.deleteTitle')"
    :buttons="[
      {
        text: t('executionTable.deleteButton'),
        action: 'delete',
        class: 'primary-btn',
      },
      {
        text: t('executionTable.cancelButton'),
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
        <span> {{ t('executionTable.deleteMessage') }}</span>
      </v-row>
    </template>
  </MBaseModal>

  <!-- Set latest plan modal (premium component injected via the latest-plan capability) -->
  <component
    :is="latestPlan.setLatestPlanModalComponent"
    v-if="selectedLatestPlanExecution && latestPlan.setLatestPlanModalComponent"
    v-model="showLatestPlanModal"
    :execution-id="selectedLatestPlanExecution.id"
    :execution-name="selectedLatestPlanExecution.name"
    @success="handleLatestPlanSuccess"
    @error="handleLatestPlanError"
  />
</template>

<script setup lang="ts">
import { inject, ref, computed } from 'vue'
import { useProjectExecutionsTable } from '@cornflow-ui/core/composables/project-execution-table/useProjectExecutionsTable'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import { useLatestPlanController } from '@cornflow-ui/core/composables/project-execution/useLatestPlanController'

// Setup i18n
const { t } = useI18n()

// Get general store
const generalStore = useGeneralStore()
// Controlador de latest-plan inyectado por el módulo premium (§3.7); inerte si no hay módulo.
const latestPlan = useLatestPlanController()

// Latest plan modal state
const showLatestPlanModal = ref(false)
const selectedLatestPlanExecution = ref<{ id: string; name: string } | null>(
  null,
)

// Check if set latest plan feature is available
const isSetLatestPlanAvailable = computed(() =>
  latestPlan.isSetLatestPlanAvailable(),
)

// Check if an execution is the current latest plan (only if feature is available)
const isLatestPlan = (executionId: string) => latestPlan.isLatestPlan(executionId)

// Check if an execution can be set as latest plan
const canSetAsLatestPlan = (state: number) =>
  latestPlan.canSetAsLatestPlan(state)

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
})

// Define emits
const emit = defineEmits(['loadExecution', 'deleteExecution', 'setLatestPlan'])

// Inject snackbar function
const showSnackbar: (message: string, type: string) => void = inject(
  'showSnackbar',
) as (message: string, type: string) => void

// Get showTimeLimit setting from config (requires both showTimeLimit and showConfigFieldsStep to be enabled)
const showTimeLimit =
  generalStore.appConfig.parameters.showExtraProjectExecutionColumns
    .showTimeLimit &&
  generalStore.appConfig.parameters.configFieldsConfig?.showConfigFieldsStep

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
  getTimeLimitDisplayUnitI18nKey,
} = useProjectExecutionsTable(props as any)

// Event handlers that use emits
const loadExecutionClick = (execution: any) => {
  emit('loadExecution', execution)
}

const confirmDeleteClick = () => {
  emit('deleteExecution', deletedItem.value)
  openConfirmationDeleteModal.value = false
}

// Latest Plan handlers
const openSetLatestPlanModal = (item: any) => {
  selectedLatestPlanExecution.value = {
    id: item.id,
    name: item.name || `Execution ${item.id}`,
  }
  showLatestPlanModal.value = true
}

const handleLatestPlanSuccess = () => {
  showSnackbar(t('latestPlan.snackbar.success'), 'success')
  emit('setLatestPlan', selectedLatestPlanExecution.value?.id)
}

const handleLatestPlanError = (message: string) => {
  showSnackbar(message || t('latestPlan.snackbar.error'), 'error')
}

const handleDownloadClick = async (item: any) => {
  item.isDownloading = true
  try {
    const result = await handleDownload(item)
    if (result && typeof result === 'object' && 'error' in result) {
      showSnackbar(t('inputOutputData.errorDownloadingExcel'), 'error')
    }
  } finally {
    item.isDownloading = false
  }
}

// Utility function to format time as HH:mm
function formatToHHmm(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// Keep all execution tables horizontally aligned by syncing the scroll position
// of every horizontal scrollbar that belongs to an executions table.
const syncHorizontalScroll = (event: Event) => {
  const source = event.target as HTMLElement | null
  if (!source) return
  const currentLeft = source.scrollLeft

  const containers = document.querySelectorAll<HTMLElement>(
    '.execution-scroll-sync',
  )

  containers.forEach((container) => {
    if (container !== source && container.scrollLeft !== currentLeft) {
      container.scrollLeft = currentLeft
    }
  })
}
</script>

<style scoped>
@import '@cornflow-ui/core/assets/styles/components/project-execution/ProjectExecutionsTable.css';
</style>
