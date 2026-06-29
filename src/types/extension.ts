/**
 * extension.ts — Contrato de puntos de extensión (core ← premium).
 *
 * El CORE define estas interfaces y las cablea (createCornflowApp / router / drawer / i18n).
 * Cada feature PREMIUM exporta un `PremiumModule` que las rellena. El core NUNCA importa un
 * módulo concreto: solo itera una lista de objetos que cumplen estas interfaces.
 *
 * Diseño y decisiones: docs/CONTRATO_PUNTOS_EXTENSION.md
 *
 * NOTA (Fase 0): este fichero es ADITIVO. Define el contrato; el cableado en el core y la
 * extracción de cada feature se hacen en pasos posteriores. Mientras `premiumModules` esté vacío,
 * el comportamiento del core no cambia.
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
 * Acceso de solo-lectura a la configuración resuelta (core + app) que el core ofrece a los
 * módulos para decidir visibilidad/capacidades. Se mantiene mínimo a propósito: los módulos no
 * deben acoplarse a todo el shape de la config. Se refinará al cablear createCornflowApp.
 */
export interface ConfigAccessor {
  /** Devuelve el bloque `core` de la config interna (parameters, etc.). */
  getCore: () => { parameters: Record<string, unknown> } & Record<string, unknown>
  /** Acceso genérico de solo-lectura para casos no cubiertos arriba. */
  get: <T = unknown>(path: string) => T | undefined
}

/** Contexto que el core pasa a los módulos para resolver gating y capacidades. */
export interface ExtensionContext {
  /** Lee flags/config de la app (core + app). */
  getConfig: () => ConfigAccessor
  /** Roles del usuario actual (para gating de menú/rutas). */
  getRoleNames: () => string[]
  /** ¿La feature está habilitada por config? (la resuelve el propio módulo). */
  isFeatureEnabled: (featureId: string) => boolean
  /**
   * ¿El usuario actual puede acceder a la vista `viewId`? (gating por rol). El core resuelve el
   * mecanismo (`@/services/rolePermissions`) con los datos del proyecto, de modo que un módulo
   * premium NO importa `@/app/rolesConfig` para hacer gating de sus rutas/menús.
   */
  isViewAllowed: (viewId: string) => boolean
}

/** §3.1 Ruta aportada por un módulo premium (se añade como hija de la ruta raíz '/'). */
export interface PremiumRoute {
  /** Segmento relativo, p. ej. 'agent' o 'configuration/section/:sectionId/:subsectionKey'. */
  path: string
  name: string
  component: RouteRecordRaw['component']
  keepAlive?: boolean
  /** p. ej. { requiresAgentFeature: true, viewId: 'agent' } — el guard genérico del core lo lee. */
  meta?: RouteRecordRaw['meta']
}

/** §3.2 Entrada del drawer (menú lateral) aportada por un módulo premium. */
export interface PremiumDrawerSection {
  /** Clave i18n del título. */
  titleKey: string
  icon: string
  /** Ruta destino; se omite si es solo cabecera con `subPages`. */
  to?: string
  /** Posición relativa en el drawer (menor = antes). */
  order?: number
  subPages?: { titleKey: string; icon: string; to: string }[]
  /** Gating por rol/condición; si se omite, visible para todos. */
  isVisible?: (ctx: ExtensionContext) => boolean
}

/**
 * §3.9 Configuración de master-data aportada por la feature premium frontend-automation:
 * tablas configurables (`config`) + secciones/grupos del drawer (sorted by `order`).
 * El core la inyecta en `configurations.masterData` durante `setConfigurations`; sin módulo
 * que la aporte, el core no muestra master-data (comportamiento no-premium).
 */
export interface MasterDataConfigContribution {
  config: Record<string, any>
  sections: AutomationSectionDef[]
  groups: AutomationGroupDef[]
}

/**
 * §3.10 Tab de ejecución del core (forma mínima que ve un decorador premium). El core la construye
 * desde sus ejecuciones cargadas; premium puede anotarla/transformarla (p. ej. el ⭐ de latest-plan).
 */
export interface ExecutionTab {
  value: unknown
  text: string
  [key: string]: unknown
}

/** Contexto extendido que el core pasa a `decorateExecutionTabs` (incluye la ruta activa). */
export interface ExecutionTabDecoratorContext extends ExtensionContext {
  /** Nombre de la ruta activa, para que el módulo pueda ocultar adornos en vistas concretas. */
  routeName?: string
}

/** Zonas del layout donde se pueden montar componentes globales premium. */
export type PremiumGlobalComponentSlot = 'app-banners' | 'app-fabs' | 'app-modals'

/** §3.3 Componente global (banner/FAB/modal) montado en el layout del core. */
export interface PremiumGlobalComponent {
  component: Component
  slot: PremiumGlobalComponentSlot
  /** Visibilidad reactiva (lee stores premium). El core solo evalúa el booleano. */
  isVisible?: (ctx: ExtensionContext) => boolean
  order?: number
  /** El componente premium se autogestiona contra sus propias stores; props opcionales. */
  props?: Record<string, unknown>
}

/** §3.4 Mensajes i18n por idioma, mergeados sobre los del core (precedencia: app > premium > core). */
export type PremiumLocaleMessages = Record<string /* lang */, Record<string, unknown>>

/** §3.5 Paso inyectable del wizard de creación de ejecución (p. ej. ETL en load-instance). BORRADOR. */
export interface PremiumWizardStep {
  wizard: 'project-execution'
  anchor: { step: 'load-instance'; position: 'replace' | 'augment' }
  component: Component
  isEnabled?: (ctx: ExtensionContext) => boolean
  /** Bloqueo de avance (p. ej. ETL exige cargar datos antes de continuar). */
  blocksAdvance?: (ctx: ExtensionContext) => boolean
}

/** §3.6 Contribución a una zona nombrada de una vista core (registro declarativo, no slots de Vue). */
export interface PremiumViewSlot {
  view: 'section-view' | 'execution-data-view' | 'create-execution-review'
  /** Zona declarada por la vista core (p. ej. 'header-actions', 'tab-indicators', 'extra-sections'). */
  zone: string
  component: Component
  isVisible?: (ctx: ExtensionContext) => boolean
  order?: number
  props?: Record<string, unknown>
}

/**
 * Estrategia inyectable de edición de tabla (p. ej. staging de "recalculation edit mode").
 * El CORE define la interfaz; PREMIUM aporta la implementación. BORRADOR (se cierra con replan).
 */
export interface TableEditStrategy {
  isStagingEnabled: () => boolean
  stageChange: (tableKey: string, change: unknown) => void
  commit: () => Promise<void>
}

/**
 * §3.7 Operaciones del backend ETL externo, inyectadas por el módulo premium `etl`.
 * El core (useInstanceProcessing) las consume por interfaz en vez de importar `useEtlStore`,
 * de modo que el core no depende del módulo premium (invariante para el empaquetado npm).
 */
export interface EtlBackendOperations {
  /** POST `/external/etl/` con los ficheros subidos; devuelve el cuerpo crudo de la respuesta. */
  useEtlBackend: (files: File[]) => Promise<any>
  /** Carga directa desde BD vía ETL (sin ficheros); devuelve el cuerpo crudo de la respuesta. */
  useEtlBackendFromDb: () => Promise<any>
}

/** §3.7 Capacidades/servicios cuya implementación es premium y el core consume por interfaz. BORRADOR. */
export interface PremiumCapabilities {
  /** Repos que extienden los del core (async bulk upload, FA schema, ETL). */
  repositories?: Record<string, unknown>
  /** Estrategia de edición para recalculación. */
  tableEditStrategy?: TableEditStrategy
  /**
   * Factory de las operaciones del backend ETL. Es una factory (no un objeto) porque la
   * implementación usa composables/stores (useEtlStore) que deben instanciarse en contexto de
   * setup; el core la invoca dentro de su propio composable (useInstanceProcessing).
   */
  etlBackend?: () => EtlBackendOperations
  /**
   * Factory del controlador del flujo de revisión ETL externo (switches de tablas/parámetros +
   * POST `/etl/update/`). El core la invoca vía `useEtlFlowController` (cae a una implementación
   * inerte si ningún módulo la aporta). Tipo del contrato en `@/types/etlFlow`.
   */
  externalEtlFlow?: () => ExternalEtlFlowController
  /**
   * Factory del controlador de recalculación (replanificación tras editar master-data/solución).
   * El core la invoca vía `useRecalculationController` (inerte si ningún módulo la aporta).
   * Tipo del contrato en `@/types/recalculation`.
   */
  recalculation?: () => RecalculationController
  /**
   * Factory del controlador de "plan actual" (latest-plan) para la tabla de ejecuciones: queries
   * + componente del modal "fijar como plan actual". El core la invoca vía `useLatestPlanController`
   * (inerte si ningún módulo la aporta). Tipo del contrato en `@/types/latestPlan`.
   */
  latestPlan?: () => LatestPlanController
}

/**
 * §2 Contrato central: un módulo premium = todo lo que una feature aporta al core, declarado.
 * El core itera la lista de módulos habilitados y cablea cada punto de extensión.
 */
export interface PremiumModule {
  /** Identificador estable: 'agent' | 'recalculation' | 'latest-plan' | 'frontend-automation' | 'etl'. */
  id: string
  /** Si devuelve false, el core ignora TODO lo del módulo. */
  isEnabled?: (ctx: ExtensionContext) => boolean
  /** §3.1 Rutas hijas de '/'. Array, o función de ctx cuando dependen de config (p. ej. routePath). */
  routes?: PremiumRoute[] | ((ctx: ExtensionContext) => PremiumRoute[])
  /** §3.2 Entradas del drawer. */
  drawerSections?: (ctx: ExtensionContext) => PremiumDrawerSection[]
  /** §3.3 Componentes globales (banners/fabs/modales). */
  globalComponents?: PremiumGlobalComponent[]
  /** §3.4 Mensajes i18n por idioma. */
  locales?: PremiumLocaleMessages
  /** §3.5 Pasos inyectables del wizard. */
  wizardSteps?: PremiumWizardStep[]
  /** §3.6 Contribuciones a zonas de vistas core. */
  viewSlots?: PremiumViewSlot[]
  /**
   * §3.10 Decorador de los tabs de ejecución del core: recibe los tabs y devuelve una versión
   * anotada/transformada (p. ej. latest-plan añade el ⭐ y la marca `isLatestPlan`). El core lo
   * invoca en `IndexView` sin conocer el módulo; varios módulos se aplican en cadena.
   */
  decorateExecutionTabs?: (
    tabs: ExecutionTab[],
    ctx: ExecutionTabDecoratorContext,
  ) => ExecutionTab[]
  /** §3.7 Capacidades inyectables consumidas por el core vía interfaz. */
  capabilities?: PremiumCapabilities
  /**
   * §3.9 Carga la config de master-data (frontend-automation). El core la llama dentro de
   * `setConfigurations`; el primer módulo que la aporte gana. Sin módulo → core sin master-data.
   */
  loadMasterDataConfig?: (
    ctx: ExtensionContext,
  ) => Promise<MasterDataConfigContribution>
  /**
   * Hook tras la carga inicial de datos del core (post-login: usuario, esquema,
   * configuración, licencias, warnings). El core lo invoca y espera dentro de
   * `initializeData`, de modo que el overlay de carga inicial permanece visible
   * hasta que terminan. Ej.: latest-plan precarga el plan actual aquí.
   */
  onInitialDataLoaded?: (ctx: ExtensionContext) => void | Promise<void>
  /** Escape hatch: registro libre sobre la instancia de Vue (plugins, provide/inject…). */
  setup?: (app: App, ctx: ExtensionContext) => void
}
