import { ref } from 'vue';
import { useGeneralStore } from '@cornflow-ui/core/stores/general';
import { Execution } from './types';

/** Matches CreateExecutionConfigParams / schemaUtils: `timeLimit` field with `minutes: true`. */
export function isConfigTimeLimitInMinutes(
  configFields: Array<{ key?: string; minutes?: boolean }> | undefined,
): boolean {
  const field = configFields?.find(
    (f) => String(f?.key ?? '').toLowerCase() === 'timelimit',
  );
  return field?.minutes === true;
}

export function getTimeLimitUnitI18nKey(
  configFields: Array<{ key?: string; minutes?: boolean }> | undefined,
): string {
  return isConfigTimeLimitInMinutes(configFields)
    ? 'configParams.minutesSuffix'
    : 'configParams.secondsSuffix';
}

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
  const handleDownload = async (
    item: Execution,
  ): Promise<true | { error: string; i18nKey?: string }> => {
    try {
      await generalStore.getDataToDownload(item.id, true, true);
      return true;
    } catch (error) {
      const i18nKey = (error as { i18nKey?: string })?.i18nKey;
      return { error: 'errorDownloadingExcel', i18nKey };
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

  const getTimeLimitDisplayUnitI18nKey = (): string => {
    return getTimeLimitUnitI18nKey(
      generalStore.appConfig.parameters?.configFields,
    );
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
    getTimeLimit,
    getTimeLimitDisplayUnitI18nKey,
  };
} 