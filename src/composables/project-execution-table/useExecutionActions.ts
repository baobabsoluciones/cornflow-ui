import { ref } from 'vue';
import { useGeneralStore } from '@/stores/general';
import { Execution } from './types';

export function useExecutionActions() {
  const generalStore = useGeneralStore();
  
  // Setup reactive state
  const openConfirmationDeleteModal = ref(false);
  const deletedItem = ref<Execution | null>(null);
  
  // Load execution action
  const loadExecution = (execution: Execution) => {
    return { action: 'loadExecution', execution };
  };

  // Delete execution action
  const deleteExecution = (item: Execution) => {
    deletedItem.value = item;
    openConfirmationDeleteModal.value = true;
  };

  // Confirm delete action
  const confirmDelete = () => {
    const result = { action: 'deleteExecution', execution: deletedItem.value };
    openConfirmationDeleteModal.value = false;
    return result;
  };

  // Cancel delete action
  const cancelDelete = () => {
    openConfirmationDeleteModal.value = false;
    deletedItem.value = null;
  };

  // Handle Excel download
  const handleDownload = async (item: Execution): Promise<true | { error: string }> => {
    try {
      await generalStore.getDataToDownload(item.id, true, true);
      return true;
    } catch (error) {
      return { error: 'errorDownloadingExcel' };
    }
  };

  // Get solver name
  const getSolverName = (item: Execution): string => {
    return item?.config?.solver || '-';
  };

  // Get time limit
  const getTimeLimit = (item: Execution): string | number => {
    return item?.config?.timeLimit || '-';
  };
  
  return {
    openConfirmationDeleteModal,
    deletedItem,
    loadExecution,
    deleteExecution,
    confirmDelete,
    cancelDelete,
    handleDownload,
    getSolverName,
    getTimeLimit
  };
} 