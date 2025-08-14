import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGeneralStore } from '@/stores/general';
import { HeaderItem } from './types';

export function useTableConfig(props: {
  formatDateByTime: boolean
}) {
  const { t } = useI18n();
  const generalStore = useGeneralStore();
  
  // Generate a unique ID for table rendering
  const tableId = ref(
    Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  );

  // Calculate header items based on configuration
  const headerExecutions = computed<HeaderItem[]>(() => {
    // Get configuration for extra columns
    let showExtraColumns;
    try {
      showExtraColumns = generalStore.appConfig.parameters?.showExtraProjectExecutionColumns;
    } catch (error) {
      console.error('Error accessing extra columns configuration:', error);
      showExtraColumns = { showEndCreationDate: false, showUserName: false, showTimeLimit: false };
    }
    
    const hasEndDate = showExtraColumns?.showEndCreationDate || false;
    const hasUserName = showExtraColumns?.showUserName || false;
    const hasTimeLimit = showExtraColumns?.showTimeLimit || false;
    const hasUserFullName = showExtraColumns?.showUserFullName || false;
    const extraColumnsCount = (hasEndDate ? 1 : 0) + (hasUserName ? 1 : 0) + (hasTimeLimit ? 1 : 0) + (hasUserFullName ? 1 : 0);
    
    // Adjust widths based on number of extra columns shown
    let descWidth = '21%';
    let nameWidth = '13%';
    let solverWidth = '14%';
    let actionWidth = '11%';
    
    if (extraColumnsCount === 1) {
      // Reduce some widths slightly
      descWidth = '19%';
      solverWidth = '12%';
      actionWidth = '10%';
    } else if (extraColumnsCount === 2) {
      // Reduce widths more significantly
      descWidth = '17%';
      nameWidth = '11%';
      solverWidth = '10%';
      actionWidth = '9%';
    }
    
    // Base columns array with the date column
    const headers: HeaderItem[] = [
      {
        title: t('executionTable.date'),
        value: 'createdAt',
        width: '9%',
        sortable: !props.formatDateByTime,
        fixedWidth: true,
      }
    ];
    
    // Add optional columns based on configuration
    if (hasEndDate) {
      headers.push({
        title: t('executionTable.endDate'),
        value: 'finishedAt',
        width: '9%',
        sortable: !props.formatDateByTime,
        fixedWidth: true,
      });
    }
    
    if (hasUserName) {
      headers.push({
        title: t('executionTable.userName'),
        value: 'userName',
        width: '9%',
        sortable: !props.formatDateByTime,
        fixedWidth: true,
      });
    }
    if (hasUserFullName) {
      headers.push({
        title: t('executionTable.userFullName'),
        value: 'userFullName',
        width: '9%',
        sortable: !props.formatDateByTime,
        fixedWidth: true,
      });
    }
        
    // Add remaining columns
    headers.push(
      {
        title: t('executionTable.name'),
        value: 'name',
        width: nameWidth,
        sortable: !props.formatDateByTime,
        fixedWidth: true,
      },
      {
        title: t('executionTable.description'),
        value: 'description',
        width: descWidth,
        sortable: !props.formatDateByTime,
        fixedWidth: true,
      },
      {
        title: t('executionTable.excel'),
        value: 'excel',
        width: '7%',
        sortable: false,
        fixedWidth: true,
      },
      {
        title: t('executionTable.state'),
        value: 'state',
        width: '7%',
        sortable: !props.formatDateByTime,
        fixedWidth: true,
      },
      {
        title: t('executionTable.solver'),
        value: 'solver',
        width: solverWidth,
        sortable: !props.formatDateByTime,
        fixedWidth: true,
      }
    );

    // Add timeLimit column only if enabled
    if (hasTimeLimit) {
      headers.push({
        title: t('executionTable.timeLimit'),
        value: 'timeLimit',
        width: '7%',
        sortable: !props.formatDateByTime,
        fixedWidth: true,
      });
    }

    // Add solution and actions columns
    headers.push(
      {
        title: t('executionTable.solution'),
        value: 'solution',
        width: '7%',
        sortable: !props.formatDateByTime,
        fixedWidth: true,
      },
      {
        title: t('executionTable.actions'),
        value: 'actions',
        width: actionWidth,
        sortable: false,
        fixedWidth: true,
      }
    );
    
    return headers;
  });

  // Calculate a unique key for table rendering based on column configuration
  const tableKey = computed(() => {
    let showExtraColumns;
    try {
      showExtraColumns = generalStore.appConfig.parameters?.showExtraProjectExecutionColumns;
    } catch (error) {
      return `basic-${tableId.value}`;
    }
    
    const hasEndDate = showExtraColumns?.showEndCreationDate || false;
    const hasUserName = showExtraColumns?.showUserName || false;
    
    return `execution-table-${hasEndDate ? 'end' : 'no-end'}-${hasUserName ? 'user' : 'no-user'}-${tableId.value}`;
  });
  
  // Method to regenerate tableId (for forcing re-render)
  const regenerateTableId = () => {
    tableId.value = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  return {
    tableId,
    headerExecutions,
    tableKey,
    regenerateTableId
  };
} 