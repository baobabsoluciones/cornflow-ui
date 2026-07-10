/**
 * index.ts — Public entry point of `@cornflow-ui/core`.
 *
 * Minimal surface of the core package: the bootstrap (`createCornflowApp`) and the extension-point
 * CONTRACT (types + registry). The bulk of the core symbols (stores, composables, components,
 * repos, utils, types…) are consumed by SUBPATH (`@cornflow-ui/core/<path>`) via the package.json
 * `exports` — not through this barrel — so the public surface is not coupled to a single file and
 * tree-shaking is preserved (the package ships sources; the project's Vite compiles them).
 *
 * In the carve into two repos, this file remains the `@cornflow-ui/core` barrel; the
 * `@cornflow-ui/enterprise` barrel (src/enterprise.ts) re-exports core and adds the premium modules.
 */

// Core bootstrap.
export { createCornflowApp } from '@cornflow-ui/core/bootstrap'
export type { CreateCornflowAppOptions } from '@cornflow-ui/core/bootstrap'

// Premium module registration (invoked by the shell/enterprise; the core never imports a module).
export { registerPremiumModules } from '@cornflow-ui/core/plugins/extensions'

// Extension-point contract (types filled in by premium and, in part, by src/app).
export type {
  ConfigAccessor,
  ExtensionContext,
  PremiumRoute,
  PremiumDrawerSection,
  MasterDataConfigContribution,
  ExecutionTab,
  ExecutionTabDecoratorContext,
  PremiumGlobalComponentSlot,
  PremiumGlobalComponent,
  PremiumLocaleMessages,
  PremiumWizardStep,
  PremiumViewSlot,
  TableEditStrategy,
  EtlBackendOperations,
  PremiumCapabilities,
  PremiumModule,
} from '@cornflow-ui/core/types/extension'
