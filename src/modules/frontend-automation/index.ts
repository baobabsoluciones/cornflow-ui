/**
 * Core module: FRONTEND-AUTOMATION (dynamic master-data).
 *
 * Provides the core with the master-data config (configurable tables + drawer sections/groups)
 * loaded from the `/frontend-automation/` endpoint, via the `loadMasterDataConfig` extension point.
 * The endpoint belongs to the external app, so the module is on only when the deployment has one
 * (`hasExternalApp`).
 * The rest of the table/section machinery (FrontendAutomationService, SectionView, AppDrawer)
 * lives in the core; this module is only the data SOURCE.
 *
 * Contract: src/types/extension.ts (§3.9).
 */
import type {
  PremiumModule,
  MasterDataConfigContribution,
} from '@cornflow-ui/core/types/extension'
import config from '@cornflow-ui/core/config'
import FaRepository from './FaRepository'

export const frontendAutomationModule: PremiumModule = {
  id: 'frontend-automation',

  isEnabled: () => config.hasExternalApp,

  loadMasterDataConfig: (): Promise<MasterDataConfigContribution> =>
    new FaRepository().getConfigurationTables(),
}

export default frontendAutomationModule
