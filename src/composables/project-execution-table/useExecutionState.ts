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
      return generalStore.appConfig.parameters?.logStates || {};
    } catch (error) {
      console.error('Error accessing log states:', error);
      return {};
    }
  });

  // Define execution states
  const stateInfo = computed<Record<string, StateInfo>>(() => {
    return {
      '1': {
        color: 'green',
        message: t('executionTable.executionSolvedCorrectly'),
        code: t('executionTable.success'),
      },
      '0': {
        color: 'purple',
        message: t('executionTable.executionRunning'),
        code: t('executionTable.loading'),
      },
      '-1': {
        color: 'red',
        message: t('executionTable.executionError'),
        code: t('executionTable.error'),
      },
      '-2': {
        color: 'red',
        message: t('executionTable.executionStopped'),
        code: t('executionTable.error'),
      },
      '-3': {
        color: 'red',
        message: t('executionTable.executionNotStarted'),
        code: t('executionTable.error'),
      },
      '-4': {
        color: 'red',
        message: t('executionTable.executionNotRun'),
        code: t('executionTable.error'),
      },
      '-5': {
        color: 'red',
        message: t('executionTable.executionUnknownError'),
        code: t('executionTable.error'),
      },
      '-6': {
        color: 'red',
        message: t('executionTable.executionFailedSaving'),
        code: t('executionTable.error'),
      },
      '2': {
        color: 'green',
        message: t('executionTable.executionLoadedManually'),
        code: t('executionTable.success'),
      },
      '-7': {
        color: 'red',
        message: t('executionTable.executionQueued'),
        code: t('executionTable.loading'),
      },
    };
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

  // Get solution color
  const getSolutionColor = (solution_state: any): string => {
    if (!solution_state || typeof solution_state !== 'object' || 
        solution_state.sol_code === undefined || solution_state.sol_code === null) {
      return 'grey';
    }
    return solution_state.sol_code === 2 ? 'green' : 'red';
  };

  // Get solution code
  const getSolutionCode = (solution_state: any): string => {
    if (!solution_state || typeof solution_state !== 'object' || 
        solution_state.status_code === undefined || solution_state.status_code === null) {
      return t('executionTable.unknown');
    }
    const statusCode = solution_state.status_code.toString();
    return solutionStateInfo.value[statusCode]?.code || t('executionTable.unknown');
  };

  // Get solution message
  const getSolutionMessage = (solution_state: any): string => {
    if (!solution_state || typeof solution_state !== 'object' || 
        solution_state.status_code === undefined || solution_state.status_code === null) {
      return t('executionTable.unknownTooltip');
    }
    const statusCode = solution_state.status_code.toString();
    return solutionStateInfo.value[statusCode]?.message || t('executionTable.unknownTooltip');
  };

  return {
    solutionStateInfo,
    stateInfo,
    getStateInfo,
    getSolutionColor,
    getSolutionCode,
    getSolutionMessage
  };
} 