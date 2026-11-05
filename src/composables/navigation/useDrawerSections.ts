/**
 * useDrawerSections — what the side menu lists: its groups and their pages, gated by the user's
 * roles and the DAG the session is on.
 *
 * Groups, in order: the history of executions (a page of its own), the entries of premium modules,
 * the app's own sections (`appSections`), master data (one group per schema section, or a single
 * "Master data"), and, with an execution selected, its input data and results (with the
 * dashboards); last, administration for admins when roles management is on. Creating an
 * execution is not a group: `canCreateExecution` says whether the menu heads with its button.
 *
 * Each group says whether it belongs to the loaded execution (`scope: 'execution'`: its input
 * data, its results, and the app sections that need one) or is the same for all of them.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import appConfig from '@/app/config'
import { isViewAllowed } from '@/app/rolesConfig'
import { getAppParameters } from '@cornflow-ui/core/utils/appParameters'
import {
  getNavigationItemsFromConfig,
  getMasterDataNavigationWithSections,
  filterValidationTablesWithData,
  enrichConfigWithChecksData,
  enrichConfigWithTablesWithoutSchema,
} from '@cornflow-ui/core/services/FrontendAutomationService'
import { applyKpiDisplayMode } from '@cornflow-ui/core/utils/kpiTableUtils'
import { resolveTitleWithLocale } from '@cornflow-ui/core/utils/i18nUtils'
import { useSectionTitles } from '@cornflow-ui/core/composables/useSectionTitles'
import { getPremiumDrawerSections } from '@cornflow-ui/core/plugins/extensions'
import { isEntryVisibleFor } from '@cornflow-ui/core/utils/navigationGating'

/** A page of the menu; it may hold pages of its own (master data groups). */
export interface DrawerPage {
  title: string
  icon?: string
  to?: string
  subPages?: DrawerPage[]
}

/** A group of the menu: a page of its own (`to`), or a heading over its pages. */
export interface DrawerSection extends DrawerPage {
  /** Stable key, for the open state of the accordion. */
  key: string
  /** `execution`: the group shows data of the loaded execution; `general`: the same for all. */
  scope: 'execution' | 'general'
}

/** Whether `page`, or any page below it, is the one at `path` (or a route nested in it). */
export function isPageActive(page: DrawerPage | null | undefined, path: string): boolean {
  if (!page) return false
  if (page.to) {
    if (path === page.to) return true
    if (path.startsWith(page.to)) {
      const next = path[page.to.length]
      if (!next || next === '/') return true
    }
  }
  return (page.subPages ?? []).some((sub) => isPageActive(sub, path))
}

export function useDrawerSections() {
  const store = useGeneralStore()
  const { t, locale } = useI18n()
  const { getSectionTitle } = useSectionTitles()

  const roleNames = computed<string[]>(
    () => store.getUser?.roles?.map((r: { name: string }) => r.name) ?? [],
  )
  /** Who is looking and on which DAG, to gate app sections and dashboard pages. */
  const viewer = computed(() => ({ roleNames: roleNames.value, schema: store.getSchemaName }))
  const allowed = (viewId: string) => isViewAllowed(roleNames.value, viewId)
  const hasSelectedExecution = computed(() => store.selectedExecution != null)

  const history = computed<DrawerSection | null>(() =>
    allowed('history-execution')
      ? { key: 'history', scope: 'general', title: t('drawer.history'), icon: 'mdi-history', to: '/history-execution' }
      : null,
  )

  const canCreateExecution = computed(() => allowed('project-execution'))

  /** Entries contributed by premium modules (enterprise), e.g. the agent. */
  const premium = computed<DrawerSection[]>(() =>
    getPremiumDrawerSections()
      .map((s, index) => ({
        key: `premium-${index}`,
        scope: 'general' as const,
        title: t(s.titleKey),
        icon: s.icon,
        to: s.to,
        subPages: s.subPages?.map((sub) => ({ title: t(sub.titleKey), icon: sub.icon, to: sub.to })),
      }))
      .filter((s) => s.to != null || (s.subPages?.length ?? 0) > 0),
  )

  /** The app's own sections (`appSections` in its config). */
  const app = computed<DrawerSection[]>(() => {
    const isVisible = (entry: any) =>
      (!entry.requiresSelectedExecution || hasSelectedExecution.value) &&
      isEntryVisibleFor(entry, viewer.value)
    return appConfig
      .getAppSections()
      .filter(isVisible)
      .map((s: any, index: number) => ({
        key: `app-${index}`,
        scope: s.requiresSelectedExecution ? ('execution' as const) : ('general' as const),
        title: t(s.titleKey),
        icon: s.icon,
        to: s.to,
        subPages: s.subPages
          ?.filter(isVisible)
          .map((sub: any) => ({ title: t(sub.titleKey), icon: sub.icon, to: sub.to })),
      }))
      .filter((s: DrawerSection) => s.to != null || (s.subPages?.length ?? 0) > 0)
  })

  /** Master data: one group per schema section (`available_automations.sections`), or a single one. */
  const masterData = computed<DrawerSection[]>(() => {
    const masterDataConfig = store.getConfigurations?.masterData || {}
    if (Object.keys(masterDataConfig).length === 0) return []
    const sections = store.masterDataSections
    const blocks =
      sections && sections.length > 0
        ? getMasterDataNavigationWithSections(
            masterDataConfig,
            sections,
            '/configuration',
            store.masterDataGroups ?? undefined,
          )
        : []
    if (blocks.length === 0) {
      return [
        {
          key: 'master-data',
          scope: 'general',
          title: getSectionTitle('masterData'),
          icon: 'mdi-database',
          subPages: getNavigationItemsFromConfig(masterDataConfig, '/configuration'),
        },
      ]
    }
    return blocks.map((block: any, index: number) => {
      const subPages = [...(block.subPages || [])]
      if (block.sectionId) {
        appConfig
          .getFrontendAutomationSectionSubsections(block.sectionId)
          .filter((def: any) => isEntryVisibleFor(def, viewer.value))
          .forEach((def: any) =>
            subPages.push({
              title: t(def.titleKey),
              icon: def.icon,
              to: `/configuration/section/${block.sectionId}/${def.path}`,
            }),
          )
      }
      return {
        key: `master-data-${block.sectionId ?? index}`,
        scope: 'general' as const,
        title:
          block.sectionId === null
            ? getSectionTitle('masterData')
            : resolveTitleWithLocale(block.title, locale.value, block.sectionId),
        icon: block.icon,
        subPages,
      }
    })
  })

  /** The selected execution's input data: its tables, then the instance dashboards. */
  const inputData = computed<DrawerSection | null>(() => {
    if (!hasSelectedExecution.value) return null
    const selected = store.selectedExecution
    const instanceData = selected.experiment?.instance || selected.instance
    let config = store.getConfigurations?.inputData || {}
    config = enrichConfigWithChecksData(config, instanceData, locale.value)
    config = filterValidationTablesWithData(config, instanceData)
    if (getAppParameters().showTablesWithoutSchema === true) {
      config = enrichConfigWithTablesWithoutSchema(config, instanceData, 'instance', locale.value)
    }
    const subPages: DrawerPage[] =
      Object.keys(config).length > 0
        ? getNavigationItemsFromConfig(config, '/input-data')
        : [{ title: t('inputOutputData.inputTitle'), icon: 'mdi-table-arrow-left', to: '/input-data' }]
    subPages.push(
      ...store.appInstanceDashboardPages.filter((page: any) => isEntryVisibleFor(page, viewer.value)),
    )
    return {
      key: 'input-data',
      scope: 'execution',
      title: getSectionTitle('inputData'),
      icon: 'mdi-application-cog',
      subPages,
    }
  })

  /** The selected execution's results: its tables, the KPIs, then the dashboards. */
  const results = computed<DrawerSection | null>(() => {
    if (!hasSelectedExecution.value) return null
    const selected = store.selectedExecution
    const solutionData = selected.experiment?.solution || selected.solution
    let config = store.getConfigurations?.resultsData || {}
    config = enrichConfigWithChecksData(config, solutionData, locale.value)
    config = filterValidationTablesWithData(config, solutionData)
    if (getAppParameters().showTablesWithoutSchema === true) {
      config = enrichConfigWithTablesWithoutSchema(config, solutionData, 'solution', locale.value)
    }
    const kpiMode = getAppParameters()?.kpiTablesDisplayMode ?? 'disabled'
    if (kpiMode !== 'disabled' && solutionData) {
      config = applyKpiDisplayMode(config, solutionData.rawKpis ?? null, kpiMode, locale.value)
    }
    const subPages: DrawerPage[] =
      Object.keys(config).length > 0
        ? getNavigationItemsFromConfig(config, '/results')
        : [{ title: t('inputOutputData.outputTitle'), icon: 'mdi-table-arrow-right', to: '/output-data' }]
    if (getAppParameters().showDashboardMainView) {
      subPages.push({ title: 'Dashboard', icon: 'mdi-view-dashboard', to: '/dashboard' })
    }
    subPages.push(
      ...store.appDashboardPages.filter((page: any) => isEntryVisibleFor(page, viewer.value)),
    )
    return {
      key: 'results',
      scope: 'execution',
      title: getSectionTitle('results'),
      icon: 'mdi-chart-box',
      subPages,
    }
  })

  const isAdmin = computed(() => roleNames.value.includes('admin'))

  /** Administration, for admins when roles management is on. */
  const admin = computed<DrawerSection | null>(() => {
    if (!isAdmin.value || !getAppParameters().enableRolesManagement) return null
    return {
      key: 'admin',
      scope: 'general',
      title: t('rolesManagement.adminSection'),
      icon: 'mdi-shield-account',
      subPages: [{ title: t('rolesManagement.title'), icon: 'mdi-account-key', to: '/roles-management' }],
    }
  })

  const sections = computed<DrawerSection[]>(() => {
    const list: DrawerSection[] = []
    if (history.value) list.push(history.value)
    list.push(...premium.value, ...app.value)
    if (allowed('configuration')) list.push(...masterData.value)
    if (inputData.value && allowed('input-data')) list.push(inputData.value)
    if (results.value && allowed('results')) list.push(results.value)
    if (admin.value) list.push(admin.value)
    return list
  })

  return { sections, isAdmin, canCreateExecution }
}
