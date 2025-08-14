import { computed, watch, nextTick, ref, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGeneralStore } from '@/stores/general';
import { useTableConfig } from './useTableConfig';
import { useTableDOMManipulation } from './useTableDOMManipulation';
import { useExecutionState } from './useExecutionState';
import { useExecutionActions } from './useExecutionActions';
import { ExecutionTableProps } from './types';

// Define types for our component
interface Execution {
  id: string;
  createdAt: string;
  finishedAt: string | null;
  state: number;
  solution_state: any; 
  name: string;
  description: string;
  userName: string | null;
  userFullName: string | null;
  config: {
    solver?: string;
    timeLimit?: number | string;
  };
  time?: string;
}

interface HeaderItem {
  title: string;
  value: string;
  width: string;
  sortable: boolean;
  fixedWidth: boolean;
}

export function useProjectExecutionsTable(props: ExecutionTableProps) {
  const { t } = useI18n();
  const generalStore = useGeneralStore();
  
  // Set up state
  const openConfirmationDeleteModal = ref(false);
  const deletedItem = ref(null);
  
  // Process executions
  const processedExecutions = computed(() => {
    return props.executionsByDate || [];
  });
  
  // Use specialized composables
  const { 
    tableId, 
    headerExecutions, 
    tableKey, 
    regenerateTableId 
  } = useTableConfig({ 
    formatDateByTime: props.formatDateByTime 
  });
  
  const { 
    addColgroup, 
    handleResize 
  } = useTableDOMManipulation(
    () => headerExecutions.value
  );
  
  const {
    solutionStateInfo,
    stateInfo,
    getStateInfo,
    getSolutionInfo,
  } = useExecutionState();
  
  const {
    openConfirmationDeleteModal: openModal,
    deletedItem: deletedExecution,
    loadExecution,
    deleteExecution,
    confirmDelete,
    cancelDelete,
    handleDownload,
    getSolverName,
    getTimeLimit
  } = useExecutionActions();
  
  // Connect the state from execution actions
  watch(openModal, (newValue) => {
    openConfirmationDeleteModal.value = newValue;
  });
  
  watch(deletedExecution, (newValue) => {
    deletedItem.value = newValue;
  });
  
  // Setup watches for changes in configuration
  watch(
    () => props.executionsByDate,
    () => {
      nextTick(() => {
        addColgroup();
      });
    },
    { deep: true }
  );
  
  // Watch for changes in extra columns configuration and regenerate table when it changes
  watch(
    () => generalStore.appConfig.parameters?.showExtraProjectExecutionColumns,
    () => {
      regenerateTableId();
      nextTick(() => {
        addColgroup();
      });
    },
    { deep: true }
  );
  
  // Lifecycle hooks
  onMounted(() => {
    addColgroup();
  });
  
  // Return everything combined
  return {
    // State
    openConfirmationDeleteModal,
    deletedItem,
    tableId,
    
    // Computed values
    processedExecutions,
    headerExecutions,
    solutionStateInfo,
    stateInfo,
    tableKey,
    
    // Methods
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
    handleResize
  };
}