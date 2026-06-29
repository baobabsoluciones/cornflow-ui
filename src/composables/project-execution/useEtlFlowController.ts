/**
 * useEtlFlowController.ts — Punto de consumo (CORE) del controlador del flujo ETL externo.
 *
 * El wizard de creación de ejecución (ProjectExecutionView) instancia AQUÍ el controlador, sin
 * conocer el módulo premium: lo pide al registro (§3.7 `capabilities.externalEtlFlow`). Si ningún
 * módulo lo aporta (build sin ETL), devuelve una implementación INERTE para que el core funcione
 * igual (flujo no activo). El contrato vive en `@/types/etlFlow`.
 */
import { computed, reactive } from 'vue'
import { getPremiumExternalEtlFlow } from '@/plugins/extensions'
import type {
  ExternalEtlFlowController,
  ExternalEtlFlowState,
} from '@/types/etlFlow'

/** Controlador inerte: flujo siempre inactivo, mutadores no-op, submitUpdate rechaza. */
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
 * Devuelve el controlador del flujo ETL: la implementación premium si el módulo `etl` está
 * registrado, o una inerte en caso contrario. Llamar en contexto de setup / Pinia activo.
 */
export function useEtlFlowController(): ExternalEtlFlowController {
  return getPremiumExternalEtlFlow() ?? createInertEtlFlowController()
}
