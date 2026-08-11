/**
 * extensions.ts — Premium module registration and wiring (core ← premium).
 *
 * The core registers the list of `PremiumModule` here (via `registerPremiumModules`) and exposes
 * query helpers (`getPremiumRoutes`, `getPremiumDrawerSections`, …) consumed by the core plugins
 * (router, i18n, drawer, layout). The core NEVER imports a concrete module.
 *
 * Contract: src/types/extension.ts · Design: docs/CONTRATO_PUNTOS_EXTENSION.md
 *
 * NOTE (Phase 0): while no module is registered, all helpers return empty and the core's
 * behavior is identical to the current one. The "register before building router/i18n" ordering
 * will be guaranteed by the bootstrap refactor (createCornflowApp) in a later step.
 */
import type { RouteRecordRaw, Router } from 'vue-router'
import appConfig from '@/app/config'
import { isViewAllowed as appIsViewAllowed } from '@/app/rolesConfig'
import type {
  PremiumModule,
  ExtensionContext,
  ConfigAccessor,
  PremiumRoute,
  PremiumDrawerSection,
  PremiumGlobalComponent,
  PremiumGlobalComponentSlot,
  PremiumLocaleMessages,
  MasterDataConfigContribution,
  ExecutionTab,
  EtlBackendOperations,
} from '@cornflow-ui/core/types/extension'
import type { ExternalEtlFlowController } from '@cornflow-ui/core/types/etlFlow'
import type { RecalculationController } from '@cornflow-ui/core/types/recalculation'
import type { LatestPlanController } from '@cornflow-ui/core/types/latestPlan'

let registeredModules: PremiumModule[] = []

/** Registers the list of premium modules. Idempotent (replaces the list). */
export function registerPremiumModules(modules: PremiumModule[]): void {
  registeredModules = [...modules]
}

/** Raw list of registered modules (not filtered by enabled state). */
export function getRegisteredPremiumModules(): PremiumModule[] {
  return registeredModules
}

function deepMerge(
  base: Record<string, any>,
  override: Record<string, any>,
): Record<string, any> {
  const result = { ...base }
  for (const key of Object.keys(override)) {
    if (
      override[key] !== null &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      typeof base[key] === 'object' &&
      base[key] !== null &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(base[key], override[key])
    } else {
      result[key] = override[key]
    }
  }
  return result
}

function buildConfigAccessor(): ConfigAccessor {
  return {
    getCore: () => appConfig.getCore() as { parameters: Record<string, unknown> } & Record<string, unknown>,
    get: <T = unknown>(path: string): T | undefined =>
      path
        .split('.')
        .reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), appConfig.getCore()),
  }
}

function getRoleNames(): string[] {
  try {
    const stored = sessionStorage.getItem('userRoles')
    if (stored) return JSON.parse(stored)
  } catch {
    /* ignore */
  }
  return []
}

/** Builds the context passed to the modules for gating/capabilities. */
export function getExtensionContext(): ExtensionContext {
  const config = buildConfigAccessor()
  return {
    getConfig: () => config,
    getRoleNames,
    isFeatureEnabled: (featureId: string): boolean => {
      const params = (appConfig.getCore()?.parameters ?? {}) as Record<string, any>
      const feature = params[featureId]
      if (feature && typeof feature === 'object' && 'enabled' in feature) {
        return Boolean(feature.enabled)
      }
      return Boolean(feature)
    },
    isViewAllowed: (viewId: string): boolean =>
      appIsViewAllowed(getRoleNames(), viewId),
  }
}

function enabledModules(ctx: ExtensionContext): PremiumModule[] {
  return registeredModules.filter((m) => (m.isEnabled ? m.isEnabled(ctx) : true))
}

function toRouteRecord(route: PremiumRoute): RouteRecordRaw {
  return {
    path: route.path,
    name: route.name,
    component: route.component,
    ...(route.keepAlive ? { keepAlive: true } : {}),
    ...(route.meta ? { meta: route.meta } : {}),
  } as RouteRecordRaw
}

/** §3.1 Premium routes (children of '/'), from the enabled modules. */
export function getPremiumRoutes(): RouteRecordRaw[] {
  const ctx = getExtensionContext()
  return enabledModules(ctx).flatMap((m) => {
    const routes = typeof m.routes === 'function' ? m.routes(ctx) : (m.routes ?? [])
    return routes.map(toRouteRecord)
  })
}

/** §3.2 Premium drawer entries, filtered by visibility and sorted. */
export function getPremiumDrawerSections(): PremiumDrawerSection[] {
  const ctx = getExtensionContext()
  return enabledModules(ctx)
    .flatMap((m) => (m.drawerSections ? m.drawerSections(ctx) : []))
    .filter((s) => (s.isVisible ? s.isVisible(ctx) : true))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/** §3.3 Premium global components for a slot (banners/fabs/modals), filtered and sorted. */
export function getPremiumGlobalComponents(
  slot: PremiumGlobalComponentSlot,
): PremiumGlobalComponent[] {
  const ctx = getExtensionContext()
  return enabledModules(ctx)
    .flatMap((m) => m.globalComponents ?? [])
    .filter((c) => c.slot === slot)
    .filter((c) => (c.isVisible ? c.isVisible(ctx) : true))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/**
 * §3.10 Applies the execution-tab decorators of the enabled modules in a chain.
 * The core (IndexView) passes its tabs and, optionally, the active route name; each module
 * annotates/transforms them (e.g. latest-plan adds the ⭐). No modules → returns the tabs untouched.
 */
export function applyPremiumExecutionTabDecorators(
  tabs: ExecutionTab[],
  extra: { routeName?: string } = {},
): ExecutionTab[] {
  const ctx = { ...getExtensionContext(), ...extra }
  return enabledModules(ctx).reduce(
    (acc, m) => (m.decorateExecutionTabs ? m.decorateExecutionTabs(acc, ctx) : acc),
    tabs,
  )
}

/** §3.4 Premium i18n messages merged per language (across modules). */
export function getMergedPremiumLocales(): PremiumLocaleMessages {
  const ctx = getExtensionContext()
  const merged: PremiumLocaleMessages = {}
  for (const m of enabledModules(ctx)) {
    if (!m.locales) continue
    for (const lang of Object.keys(m.locales)) {
      merged[lang] = deepMerge(merged[lang] ?? {}, m.locales[lang])
    }
  }
  return merged
}

/**
 * Runs the `onInitialDataLoaded` hooks of the enabled modules and awaits them all.
 * The core calls it from `initializeData` after loading the base data, so it does not
 * need to know any premium module (e.g. the latest-plan preload).
 */
export async function runPremiumInitialDataHooks(): Promise<void> {
  const ctx = getExtensionContext()
  await Promise.all(
    enabledModules(ctx).map((m) =>
      m.onInitialDataLoaded ? m.onInitialDataLoaded(ctx) : undefined,
    ),
  )
}

/**
 * §3.7 ETL backend operations from the first premium module that provides them (`etl` module).
 * Returns `null` if no module provides them, so the core (useInstanceProcessing) uses
 * the frontend path. Invokes the module's factory, so it must be called in a setup context.
 */
export function getPremiumEtlBackend(): EtlBackendOperations | null {
  const ctx = getExtensionContext()
  const mod = enabledModules(ctx).find((m) => m.capabilities?.etlBackend)
  return mod ? mod.capabilities!.etlBackend!() : null
}

/**
 * §3.7 ETL review flow controller from the first premium module that provides it (`etl`).
 * Returns `null` if none provides it; the core (useEtlFlowController) falls back to an inert
 * implementation. Invokes the module's factory, so it must be called in a setup context / with Pinia active.
 */
export function getPremiumExternalEtlFlow(): ExternalEtlFlowController | null {
  const ctx = getExtensionContext()
  const mod = enabledModules(ctx).find((m) => m.capabilities?.externalEtlFlow)
  return mod ? mod.capabilities!.externalEtlFlow!() : null
}

/**
 * §3.7 Recalculation controller from the first premium module that provides it (`recalculation`).
 * Returns `null` if none provides it; the core (useRecalculationController) falls back to an
 * inert implementation. Invokes the module's factory (call in a setup context / with Pinia active).
 */
export function getPremiumRecalculation(): RecalculationController | null {
  const ctx = getExtensionContext()
  const mod = enabledModules(ctx).find((m) => m.capabilities?.recalculation)
  return mod ? mod.capabilities!.recalculation!() : null
}

/**
 * §3.7 "Latest plan" controller (latest-plan) from the first premium module that provides it.
 * Returns `null` if none provides it; the core (useLatestPlanController) falls back to an inert
 * implementation. Invokes the module's factory (call in a setup context / with Pinia active).
 */
export function getPremiumLatestPlan(): LatestPlanController | null {
  const ctx = getExtensionContext()
  const mod = enabledModules(ctx).find((m) => m.capabilities?.latestPlan)
  return mod ? mod.capabilities!.latestPlan!() : null
}

/**
 * §3.9 Loads the master-data config from the first premium module that provides it
 * (frontend-automation). Returns `null` if no module provides it, so the core
 * works without master-data (non-premium). The core calls it from `setConfigurations`.
 */
export async function loadPremiumMasterDataConfig(): Promise<MasterDataConfigContribution | null> {
  const ctx = getExtensionContext()
  const mod = enabledModules(ctx).find((m) => m.loadMasterDataConfig)
  if (!mod) return null
  return mod.loadMasterDataConfig!(ctx)
}

/** Minimal i18n interface we need to inject locales (avoids coupling to the version). */
interface I18nMessageTarget {
  global: {
    getLocaleMessage: (locale: string) => Record<string, unknown>
    setLocaleMessage: (locale: string, message: Record<string, unknown>) => void
  }
}

/**
 * Injects the premium routes into the already-built router (not at import time).
 * Called after `registerPremiumModules`, so it does not depend on import order.
 * Premium routes are added as children of the root route (default 'Home').
 */
export function applyPremiumRoutes(router: Router, parentName = 'Home'): void {
  for (const record of getPremiumRoutes()) {
    router.addRoute(parentName, record)
  }
}

/**
 * Injects the premium locales into the already-built i18n instance.
 * Precedence: the existing messages (core + app) win over the premium ones
 * (`deepMerge(premium, current)`), so a project never sees its texts overridden by premium.
 * Since premium modules use their own namespaces (agent.*, recalculation.*, …), in practice
 * they only add new keys. (Note: exact app > premium > core precedence would require separate
 * layers; see docs/CONTRATO_PUNTOS_EXTENSION.md.)
 */
export function applyPremiumLocales(i18n: I18nMessageTarget): void {
  const premium = getMergedPremiumLocales()
  for (const lang of Object.keys(premium)) {
    const current = i18n.global.getLocaleMessage(lang) ?? {}
    i18n.global.setLocaleMessage(lang, deepMerge(premium[lang], current))
  }
}
