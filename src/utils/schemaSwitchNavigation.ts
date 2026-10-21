/**
 * schemaSwitchNavigation.ts — Whether the view on screen still exists after a DAG switch.
 *
 * After `setActiveSchema` the user stays on the current route when the new DAG has it, and goes
 * to the default view (the new DAG's `defaultView`) otherwise.
 */
import appConfig from '@/app/config'
import type { TableSchema } from '@cornflow-ui/core/config/views'
import { getNavigationItemsFromConfig } from '@cornflow-ui/core/services/FrontendAutomationService'
import { isOnInstanceDependentRoute } from '@cornflow-ui/core/utils/instanceDependentRoutes'
import {
  isEntryVisibleFor,
  type NavigationGating,
  type NavigationViewer,
} from '@cornflow-ui/core/utils/navigationGating'

/** The part of a route the decision reads. */
export interface SwitchedRoute {
  path: string
  params?: Record<string, unknown>
  matched?: Array<{ meta?: Record<string, unknown> }>
}

const CONFIGURATION_PREFIX = '/configuration'
const CONFIGURATION_SECTION_PREFIX = '/configuration/section/'

/** Every drawer path of the master-data tables and groups in `masterData`. */
function masterDataPaths(masterData: TableSchema): Set<string> {
  const paths = new Set<string>()
  const collect = (items: Array<{ to?: string; subPages?: Array<{ to?: string }> }>) => {
    for (const item of items) {
      if (item.to) paths.add(item.to)
      if (item.subPages) collect(item.subPages)
    }
  }
  collect(getNavigationItemsFromConfig(masterData, CONFIGURATION_PREFIX))
  return paths
}

function isSubsectionAvailable(
  route: SwitchedRoute,
  masterData: TableSchema,
  viewer: NavigationViewer,
): boolean {
  const sectionId = String(route.params?.sectionId ?? '')
  const subsectionKey = String(route.params?.subsectionKey ?? '')
  const sectionHasTables = Object.values(masterData).some(
    (table) => (table as { section?: string | null })?.section === sectionId,
  )
  const def = appConfig.getFrontendAutomationSubsectionDef(sectionId, subsectionKey)
  return sectionHasTables && def !== null && isEntryVisibleFor(def, viewer)
}

/**
 * True when `route` exists on the DAG the session has just switched to. `masterData` holds the
 * new DAG's master-data tables and `viewer` the user and the new DAG. Not available:
 * - views of the selected execution, which the switch closes;
 * - routes whose `roles` / `schemas` leave the viewer out;
 * - master-data tables, groups and section sub-sections the new DAG does not have.
 */
export function isRouteAvailableAfterSchemaSwitch(
  route: SwitchedRoute,
  masterData: TableSchema,
  viewer: NavigationViewer,
): boolean {
  if (isOnInstanceDependentRoute(route.path)) return false

  const gatedOut = (route.matched ?? []).some(
    (record) =>
      (record.meta?.roles || record.meta?.schemas) &&
      !isEntryVisibleFor(record.meta as NavigationGating, viewer),
  )
  if (gatedOut) return false

  if (route.path.startsWith(CONFIGURATION_SECTION_PREFIX)) {
    return isSubsectionAvailable(route, masterData, viewer)
  }
  if (route.path.startsWith(CONFIGURATION_PREFIX)) {
    return masterDataPaths(masterData).has(route.path)
  }
  return true
}
