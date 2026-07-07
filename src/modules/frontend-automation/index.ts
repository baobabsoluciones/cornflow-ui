/**
 * Módulo premium: FRONTEND-AUTOMATION (master-data dinámico).
 *
 * Aporta al core la config de master-data (tablas configurables + secciones/grupos del drawer)
 * cargada desde el endpoint `/frontend-automation/`, vía el punto de extensión `loadMasterDataConfig`.
 * El resto de la maquinaria de tablas/secciones (FrontendAutomationService, SectionView, AppDrawer)
 * permanece en el core; este módulo solo es la FUENTE de datos premium.
 *
 * Contrato: src/types/extension.ts (§3.9) · Diseño: docs/CONTRATO_PUNTOS_EXTENSION.md
 */
import type {
  PremiumModule,
  MasterDataConfigContribution,
} from '@cornflow-ui/core/types/extension'
import FaRepository from './FaRepository'

export const frontendAutomationModule: PremiumModule = {
  id: 'frontend-automation',

  loadMasterDataConfig: (): Promise<MasterDataConfigContribution> =>
    new FaRepository().getConfigurationTables(),
}

export default frontendAutomationModule
