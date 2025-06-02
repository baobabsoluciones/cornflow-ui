import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGeneralStore } from '@/stores/general';
import { StateInfo } from './types';

export function useExecutionState() {
  const { t } = useI18n();
  const generalStore = useGeneralStore();
  
  // Get solution state information
  const solutionStateInfo = computed(() => {
    try {
      return generalStore.appConfig.parameters?.solutionStates || {};
    } catch (error) {
      console.error('Error accessing log states:', error);
      return {};
    }
  });

  // Define execution states
  const stateInfo =computed(() => {
    try {
      return generalStore.appConfig.parameters?.executionStates || {};
    } catch (error) {
      console.error('Error accessing log states:', error);
      return {};
    }
  });
  // Get state information
  const getStateInfo = (state: number | undefined | null): StateInfo => {
    if (state === undefined || state === null) {
      return {
        color: 'grey',
        message: t('executionTable.unknown'),
        code: t('executionTable.unknown'),
      };
    }
    
    const stateKey = state.toString();
    return stateInfo.value[stateKey] || {
      color: 'grey',
      message: t('executionTable.unknown'),
      code: t('executionTable.unknown'),
    };
  };

  const getSolutionInfo = (solution_state: any): StateInfo => {
    if (!solution_state || typeof solution_state !== 'object' || 
        solution_state.status_code === undefined || solution_state.status_code === null) {
      return {
        color: 'grey',
        message: t('executionTable.unknown'),
        code: t('executionTable.unknown'),
      };
    }
    const statusCode = solution_state.status_code.toString();
    return solutionStateInfo.value[statusCode] || {
      color: 'grey',
      message: t('executionTable.unknown'),
      code: t('executionTable.unknown'),
    };
  };

  return {
    solutionStateInfo,
    stateInfo,
    getStateInfo,
    getSolutionInfo,
  };
} 