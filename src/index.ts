/**
 * index.ts — Punto de entrada público de `@cornflow-ui/core`.
 *
 * Superficie mínima del paquete core: el arranque (`createCornflowApp`) y el CONTRATO de puntos
 * de extensión (tipos + registro). El grueso de los símbolos del core (stores, composables,
 * componentes, repos, utils, types…) se consume por SUBPATH (`@cornflow-ui/core/<ruta>`) vía el
 * `exports` del package.json — no por este barrel — para no acoplar la superficie pública a un
 * único fichero ni romper tree-shaking (modelo Opción A: se shippean fuentes, el Vite del
 * proyecto compila).
 *
 * En el carve a dos repos, este fichero queda como el barrel de `@cornflow-ui/core`; el barrel de
 * `@cornflow-ui/enterprise` (src/enterprise.ts) reexporta core y añade los módulos premium.
 * Ver docs/PLAN_MIGRACION_NPM_PACKAGES.md (§2) y docs/CONTRATO_PUNTOS_EXTENSION.md.
 */

// Arranque del core.
export { createCornflowApp } from '@cornflow-ui/core/bootstrap'
export type { CreateCornflowAppOptions } from '@cornflow-ui/core/bootstrap'

// Registro de módulos premium (lo invoca el shell/enterprise; el core nunca importa un módulo).
export { registerPremiumModules } from '@cornflow-ui/core/plugins/extensions'

// Contrato de puntos de extensión (tipos que rellena el premium y, en parte, src/app).
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
