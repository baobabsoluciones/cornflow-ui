/**
 * useEtlFlowController.ts — CORE consumption point for the external ETL flow controller.
 *
 * The execution-creation wizard (ProjectExecutionView) instantiates the controller HERE, without
 * knowing about the premium module: it requests it from the registry (§3.7 `capabilities.externalEtlFlow`).
 * If no module provides it (build without ETL), it returns an INERT implementation so the core keeps
 * working the same (flow not active). The contract lives in `@/types/etlFlow`.
 */
import { computed, reactive } from 'vue'
import { getPremiumExternalEtlFlow } from '@cornflow-ui/core/plugins/extensions'
import type {
  ExternalEtlFlowController,
  ExternalEtlFlowState,
} from '@cornflow-ui/core/types/etlFlow'

/** Inert controller: flow always inactive, no-op mutators, submitUpdate rejects. */
function createInertEtlFlowController(): ExternalEtlFlowController {
  const state = reactive<ExternalEtlFlowState>({
    initialData: null,
    currentData: null,
    metadata: null,
    tableSwitches: {},
    parameterSwitches: {},
    parameterTableNames: new Set(),
  })
  return {
    state,
    isActive: computed(() => false),
    initializeFromEtlResponse: () => {},
    markTableEdited: () => {},
    markAllReuploaded: () => {},
    setTableFixed: () => {},
    setParameterFixed: () => {},
    buildAdditionalMetadata: () => ({ tables: {}, parameters: {} }),
    submitUpdate: () =>
      Promise.reject(new Error('ETL flow is not available (premium module not enabled)')),
    reset: () => {},
  }
}

/**
 * Returns the ETL flow controller: the premium implementation if the `etl` module is
 * registered, or an inert one otherwise. Call within a setup context / active Pinia.
 */
export function useEtlFlowController(): ExternalEtlFlowController {
  return getPremiumExternalEtlFlow() ?? createInertEtlFlowController()
}
