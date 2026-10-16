import appConfig from '@/app/config'

/** Core routes that only make sense with a selected execution. */
const CORE_INSTANCE_DEPENDENT_ROUTE_PREFIXES = [
  '/input-data',
  '/output-data',
  '/results',
  '/dashboard',
]

/**
 * True when `path` shows data of the selected execution: the core's input data, results and
 * dashboard views, and the app sections declared with `requiresSelectedExecution`.
 */
export function isOnInstanceDependentRoute(path: string): boolean {
  if (
    CORE_INSTANCE_DEPENDENT_ROUTE_PREFIXES.some((prefix) =>
      path.startsWith(prefix),
    )
  ) {
    return true
  }
  return appConfig
    .getInstanceDependentAppRoutePrefixes()
    .some((prefix) => path.startsWith(prefix))
}
