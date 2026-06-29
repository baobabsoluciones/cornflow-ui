/**
 * extensions.ts — Registro y cableado de los módulos premium (core ← premium).
 *
 * El core registra aquí la lista de `PremiumModule` (vía `registerPremiumModules`) y expone
 * helpers de consulta (`getPremiumRoutes`, `getPremiumDrawerSections`, …) que los plugins del core
 * (router, i18n, drawer, layout) consumen. El core NUNCA importa un módulo concreto.
 *
 * Contrato: src/types/extension.ts · Diseño: docs/CONTRATO_PUNTOS_EXTENSION.md
 *
 * NOTA (Fase 0): mientras no se registre ningún módulo, todos los helpers devuelven vacío y el
 * comportamiento del core es idéntico al actual. El orden "registrar antes de construir router/i18n"
 * lo garantizará el refactor de bootstrap (createCornflowApp) en un paso posterior.
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
} from '@/types/extension'
import type { ExternalEtlFlowController } from '@/types/etlFlow'
import type { RecalculationController } from '@/types/recalculation'
import type { LatestPlanController } from '@/types/latestPlan'

let registeredModules: PremiumModule[] = []

/** Registra la lista de módulos premium. Idempotente (reemplaza la lista). */
export function registerPremiumModules(modules: PremiumModule[]): void {
  registeredModules = [...modules]
}

/** Lista cruda de módulos registrados (sin filtrar por habilitado). */
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

/** Construye el contexto que se pasa a los módulos para gating/capacidades. */
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

/** §3.1 Rutas premium (hijas de '/'), de los módulos habilitados. */
export function getPremiumRoutes(): RouteRecordRaw[] {
  const ctx = getExtensionContext()
  return enabledModules(ctx).flatMap((m) => {
    const routes = typeof m.routes === 'function' ? m.routes(ctx) : (m.routes ?? [])
    return routes.map(toRouteRecord)
  })
}

/** §3.2 Entradas de drawer premium, filtradas por visibilidad y ordenadas. */
export function getPremiumDrawerSections(): PremiumDrawerSection[] {
  const ctx = getExtensionContext()
  return enabledModules(ctx)
    .flatMap((m) => (m.drawerSections ? m.drawerSections(ctx) : []))
    .filter((s) => (s.isVisible ? s.isVisible(ctx) : true))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/** §3.3 Componentes globales premium para una zona (banners/fabs/modales), filtrados y ordenados. */
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
 * §3.10 Aplica en cadena los decoradores de tabs de ejecución de los módulos habilitados.
 * El core (IndexView) pasa sus tabs y, opcionalmente, el nombre de la ruta activa; cada módulo
 * los anota/transforma (p. ej. latest-plan añade el ⭐). Sin módulos → devuelve los tabs intactos.
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

/** §3.4 Mensajes i18n premium mergeados por idioma (entre módulos). */
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
 * Ejecuta los hooks `onInitialDataLoaded` de los módulos habilitados y espera a todos.
 * El core lo llama desde `initializeData` tras cargar los datos base, de modo que no
 * necesita conocer ningún módulo premium (p. ej. la precarga de latest-plan).
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
 * §3.7 Operaciones del backend ETL del primer módulo premium que las aporte (módulo `etl`).
 * Devuelve `null` si ningún módulo las aporta, de modo que el core (useInstanceProcessing) usa
 * el camino frontend. Invoca la factory del módulo, por lo que debe llamarse en contexto de setup.
 */
export function getPremiumEtlBackend(): EtlBackendOperations | null {
  const ctx = getExtensionContext()
  const mod = enabledModules(ctx).find((m) => m.capabilities?.etlBackend)
  return mod ? mod.capabilities!.etlBackend!() : null
}

/**
 * §3.7 Controlador del flujo de revisión ETL del primer módulo premium que lo aporte (`etl`).
 * Devuelve `null` si ninguno lo aporta; el core (useEtlFlowController) cae a una implementación
 * inerte. Invoca la factory del módulo, por lo que debe llamarse en contexto de setup/Pinia activo.
 */
export function getPremiumExternalEtlFlow(): ExternalEtlFlowController | null {
  const ctx = getExtensionContext()
  const mod = enabledModules(ctx).find((m) => m.capabilities?.externalEtlFlow)
  return mod ? mod.capabilities!.externalEtlFlow!() : null
}

/**
 * §3.7 Controlador de recalculación del primer módulo premium que lo aporte (`recalculation`).
 * Devuelve `null` si ninguno lo aporta; el core (useRecalculationController) cae a una
 * implementación inerte. Invoca la factory del módulo (llamar en contexto de setup/Pinia activo).
 */
export function getPremiumRecalculation(): RecalculationController | null {
  const ctx = getExtensionContext()
  const mod = enabledModules(ctx).find((m) => m.capabilities?.recalculation)
  return mod ? mod.capabilities!.recalculation!() : null
}

/**
 * §3.7 Controlador de "plan actual" (latest-plan) del primer módulo premium que lo aporte.
 * Devuelve `null` si ninguno lo aporta; el core (useLatestPlanController) cae a una implementación
 * inerte. Invoca la factory del módulo (llamar en contexto de setup/Pinia activo).
 */
export function getPremiumLatestPlan(): LatestPlanController | null {
  const ctx = getExtensionContext()
  const mod = enabledModules(ctx).find((m) => m.capabilities?.latestPlan)
  return mod ? mod.capabilities!.latestPlan!() : null
}

/**
 * §3.9 Carga la config de master-data del primer módulo premium que la aporte
 * (frontend-automation). Devuelve `null` si ningún módulo la aporta, de modo que el core
 * funciona sin master-data (no-premium). El core lo llama desde `setConfigurations`.
 */
export async function loadPremiumMasterDataConfig(): Promise<MasterDataConfigContribution | null> {
  const ctx = getExtensionContext()
  const mod = enabledModules(ctx).find((m) => m.loadMasterDataConfig)
  if (!mod) return null
  return mod.loadMasterDataConfig!(ctx)
}

/** Interfaz mínima del i18n que necesitamos para inyectar locales (evita acoplarse a la versión). */
interface I18nMessageTarget {
  global: {
    getLocaleMessage: (locale: string) => Record<string, unknown>
    setLocaleMessage: (locale: string, message: Record<string, unknown>) => void
  }
}

/**
 * Inyecta las rutas premium en el router YA construido (no en tiempo de import).
 * Se llama tras `registerPremiumModules`, de modo que no depende del orden de import.
 * Las rutas premium se añaden como hijas de la ruta raíz (por defecto 'Home').
 */
export function applyPremiumRoutes(router: Router, parentName = 'Home'): void {
  for (const record of getPremiumRoutes()) {
    router.addRoute(parentName, record)
  }
}

/**
 * Inyecta los locales premium en la instancia i18n YA construida.
 * Precedencia: los mensajes existentes (core + app) ganan sobre los premium
 * (`deepMerge(premium, current)`), de modo que un proyecto nunca ve sus textos pisados por premium.
 * Como los módulos premium usan namespaces propios (agent.*, recalculation.*, …), en la práctica
 * solo añaden claves nuevas. (Nota: precedencia exacta app > premium > core requeriría capas
 * separadas; ver docs/CONTRATO_PUNTOS_EXTENSION.md.)
 */
export function applyPremiumLocales(i18n: I18nMessageTarget): void {
  const premium = getMergedPremiumLocales()
  for (const lang of Object.keys(premium)) {
    const current = i18n.global.getLocaleMessage(lang) ?? {}
    i18n.global.setLocaleMessage(lang, deepMerge(premium[lang], current))
  }
}
