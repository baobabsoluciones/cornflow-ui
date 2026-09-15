/**
 * extension.ts — Extension-points contract (core ← premium).
 *
 * The CORE defines these interfaces and wires them (createCornflowApp / router / drawer / i18n).
 * Each PREMIUM feature exports a `PremiumModule` that fills them in. The core NEVER imports a
 * concrete module: it only iterates a list of objects that satisfy these interfaces.
 *
 * Design and decisions: docs/CONTRATO_PUNTOS_EXTENSION.md
 *
 * NOTE (Phase 0): this file is ADDITIVE. It defines the contract; the wiring in the core and the
 * extraction of each feature happen in later steps. While `premiumModules` is empty,
 * the core's behavior does not change.
 */
import type { App, Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import type {
  AutomationSectionDef,
  AutomationGroupDef,
} from '@cornflow-ui/core/types/frontendAutomation'
import type { ExternalEtlFlowController } from '@cornflow-ui/core/types/etlFlow'
import type { RecalculationController } from '@cornflow-ui/core/types/recalculation'
import type { LatestPlanController } from '@cornflow-ui/core/types/latestPlan'

/**
 * Read-only access to the resolved configuration (core + app) that the core offers to the
 * modules for deciding visibility/capabilities. Kept minimal on purpose: modules should not
 * couple to the entire config shape. Will be refined when wiring createCornflowApp.
 */
export interface ConfigAccessor {
  /** Returns the `core` block of the internal config (parameters, etc.). */
  getCore: () => { parameters: Record<string, unknown> } & Record<string, unknown>
  /** Generic read-only access for cases not covered above. */
  get: <T = unknown>(path: string) => T | undefined
}

/** Context the core passes to modules to resolve gating and capabilities. */
export interface ExtensionContext {
  /** Reads app flags/config (core + app). */
  getConfig: () => ConfigAccessor
  /** Current user's roles (for menu/route gating). */
  getRoleNames: () => string[]
  /** Is the feature enabled by config? (resolved by the module itself). */
  isFeatureEnabled: (featureId: string) => boolean
  /**
   * Can the current user access the `viewId` view? (role gating). The core resolves the
   * mechanism (`@/services/rolePermissions`) with the project data, so that a premium
   * module does NOT import `@/app/rolesConfig` to gate its routes/menus.
   */
  isViewAllowed: (viewId: string) => boolean
}

/** §3.1 Route contributed by a premium module (added as a child of the root route '/'). */
export interface PremiumRoute {
  /** Relative segment, e.g. 'agent' or 'configuration/section/:sectionId/:subsectionKey'. */
  path: string
  name: string
  component: RouteRecordRaw['component']
  keepAlive?: boolean
  /** e.g. { requiresAgentFeature: true, viewId: 'agent' } — the core's generic guard reads it. */
  meta?: RouteRecordRaw['meta']
}

/** §3.2 Drawer (side menu) entry contributed by a premium module. */
export interface PremiumDrawerSection {
  /** i18n key of the title. */
  titleKey: string
  icon: string
  /** Target route; omitted if it is only a header with `subPages`. */
  to?: string
  /** Relative position in the drawer (lower = earlier). */
  order?: number
  subPages?: { titleKey: string; icon: string; to: string }[]
  /** Role/condition gating; if omitted, visible to everyone. */
  isVisible?: (ctx: ExtensionContext) => boolean
}

/**
 * §3.9 Master-data configuration contributed by the premium frontend-automation feature:
 * configurable tables (`config`) + drawer sections/groups (sorted by `order`).
 * The core injects it into `configurations.masterData` during `setConfigurations`; without a
 * module that contributes it, the core does not show master-data (non-premium behavior).
 */
export interface MasterDataConfigContribution {
  config: Record<string, any>
  sections: AutomationSectionDef[]
  groups: AutomationGroupDef[]
}

/**
 * §3.10 Core execution tab (minimal shape seen by a premium decorator). The core builds it
 * from its loaded executions; premium can annotate/transform it (e.g. the ⭐ of latest-plan).
 */
export interface ExecutionTab {
  value: unknown
  text: string
  [key: string]: unknown
}

/** Extended context the core passes to `decorateExecutionTabs` (includes the active route). */
export interface ExecutionTabDecoratorContext extends ExtensionContext {
  /** Name of the active route, so the module can hide adornments in specific views. */
  routeName?: string
}

/** Layout zones where premium global components can be mounted. */
export type PremiumGlobalComponentSlot = 'app-banners' | 'app-fabs' | 'app-modals'

/** §3.3 Global component (banner/FAB/modal) mounted in the core's layout. */
export interface PremiumGlobalComponent {
  component: Component
  slot: PremiumGlobalComponentSlot
  /** Reactive visibility (reads premium stores). The core only evaluates the boolean. */
  isVisible?: (ctx: ExtensionContext) => boolean
  order?: number
  /** The premium component self-manages against its own stores; props optional. */
  props?: Record<string, unknown>
}

/** §3.4 i18n messages per language, merged over the core's (precedence: app > premium > core). */
export type PremiumLocaleMessages = Record<string /* lang */, Record<string, unknown>>

/** §3.5 Injectable step of the execution-creation wizard (e.g. ETL in load-instance). DRAFT. */
export interface PremiumWizardStep {
  wizard: 'project-execution'
  anchor: { step: 'load-instance'; position: 'replace' | 'augment' }
  component: Component
  isEnabled?: (ctx: ExtensionContext) => boolean
  /** Advance blocking (e.g. ETL requires loading data before continuing). */
  blocksAdvance?: (ctx: ExtensionContext) => boolean
}

/** §3.6 Contribution to a named zone of a core view (declarative registration, not Vue slots). */
export interface PremiumViewSlot {
  view: 'section-view' | 'execution-data-view' | 'create-execution-review'
  /** Zone declared by the core view (e.g. 'header-actions', 'tab-indicators', 'extra-sections'). */
  zone: string
  component: Component
  isVisible?: (ctx: ExtensionContext) => boolean
  order?: number
  props?: Record<string, unknown>
}

/**
 * Injectable table-editing strategy (e.g. staging of "recalculation edit mode").
 * The CORE defines the interface; PREMIUM provides the implementation. DRAFT (finalized with replan).
 */
export interface TableEditStrategy {
  isStagingEnabled: () => boolean
  stageChange: (tableKey: string, change: unknown) => void
  commit: () => Promise<void>
}

/**
 * §3.7 External ETL backend operations, injected by the premium `etl` module.
 * The core (useInstanceProcessing) consumes them by interface instead of importing `useEtlStore`,
 * so that the core does not depend on the premium module (invariant for the npm packaging).
 */
export interface EtlBackendOperations {
  /** POST `/external/etl/` with the uploaded files; returns the raw response body. */
  useEtlBackend: (files: File[]) => Promise<any>
  /** Direct load from DB via ETL (no files); returns the raw response body. */
  useEtlBackendFromDb: () => Promise<any>
}

/** §3.7 Capabilities/services whose implementation is premium and the core consumes by interface. DRAFT. */
export interface PremiumCapabilities {
  /** Repos that extend the core's (async bulk upload, FA schema, ETL). */
  repositories?: Record<string, unknown>
  /** Editing strategy for recalculation. */
  tableEditStrategy?: TableEditStrategy
  /**
   * Factory for the ETL backend operations. It is a factory (not an object) because the
   * implementation uses composables/stores (useEtlStore) that must be instantiated in setup
   * context; the core invokes it inside its own composable (useInstanceProcessing).
   */
  etlBackend?: () => EtlBackendOperations
  /**
   * Factory for the external ETL review flow controller (table/parameter switches +
   * POST `/etl/update/`). The core invokes it via `useEtlFlowController` (falls back to an inert
   * implementation if no module contributes it). Contract type in `@/types/etlFlow`.
   */
  externalEtlFlow?: () => ExternalEtlFlowController
  /**
   * Factory for the recalculation controller (replanning after editing master-data/solution).
   * The core invokes it via `useRecalculationController` (inert if no module contributes it).
   * Contract type in `@/types/recalculation`.
   */
  recalculation?: () => RecalculationController
  /**
   * Factory for the "latest plan" (latest-plan) controller for the executions table: queries
   * + component of the "pin as latest plan" modal. The core invokes it via `useLatestPlanController`
   * (inert if no module contributes it). Contract type in `@/types/latestPlan`.
   */
  latestPlan?: () => LatestPlanController
}

/**
 * §2 Central contract: a premium module = everything a feature contributes to the core, declared.
 * The core iterates the list of enabled modules and wires each extension point.
 */
export interface PremiumModule {
  /** Stable identifier: 'agent' | 'recalculation' | 'latest-plan' | 'frontend-automation' | 'etl'. */
  id: string
  /** If it returns false, the core ignores EVERYTHING from the module. */
  isEnabled?: (ctx: ExtensionContext) => boolean
  /** §3.1 Child routes of '/'. Array, or a function of ctx when they depend on config (e.g. routePath). */
  routes?: PremiumRoute[] | ((ctx: ExtensionContext) => PremiumRoute[])
  /** §3.2 Drawer entries. */
  drawerSections?: (ctx: ExtensionContext) => PremiumDrawerSection[]
  /** §3.3 Global components (banners/fabs/modals). */
  globalComponents?: PremiumGlobalComponent[]
  /** §3.4 i18n messages per language. */
  locales?: PremiumLocaleMessages
  /** §3.5 Injectable wizard steps. */
  wizardSteps?: PremiumWizardStep[]
  /** §3.6 Contributions to core view zones. */
  viewSlots?: PremiumViewSlot[]
  /**
   * §3.10 Decorator for the core's execution tabs: receives the tabs and returns an
   * annotated/transformed version (e.g. latest-plan adds the ⭐ and the `isLatestPlan` mark). The core
   * invokes it in `IndexView` without knowing the module; several modules are applied in a chain.
   */
  decorateExecutionTabs?: (
    tabs: ExecutionTab[],
    ctx: ExecutionTabDecoratorContext,
  ) => ExecutionTab[]
  /** §3.7 Injectable capabilities consumed by the core via interface. */
  capabilities?: PremiumCapabilities
  /**
   * §3.9 Loads the master-data config (frontend-automation). The core calls it inside
   * `setConfigurations`; the first module that contributes it wins. Without a module → core without master-data.
   */
  loadMasterDataConfig?: (
    ctx: ExtensionContext,
  ) => Promise<MasterDataConfigContribution>
  /**
   * Hook after the core's initial data load (post-login: user, schema,
   * configuration, licenses, warnings). The core invokes and awaits it inside
   * `initializeData`, so that the initial loading overlay stays visible
   * until they finish. E.g.: latest-plan preloads the latest plan here.
   */
  onInitialDataLoaded?: (ctx: ExtensionContext) => void | Promise<void>
  /** Escape hatch: free registration on the Vue instance (plugins, provide/inject…). */
  setup?: (app: App, ctx: ExtensionContext) => void
}
