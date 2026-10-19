/**
 * schemaLabels.ts — Reads the text of each DAG in the module selector (`schemaLabels` in the app
 * config).
 *
 * Projects written before this setting existed do not declare it in their `src/app/config.ts`, so
 * every DAG then shows its name.
 */
import appConfig from '@/app/config'

function readParameters(): Record<string, unknown> {
  try {
    return (appConfig.getCore()?.parameters ?? {}) as Record<string, unknown>
  } catch {
    return {}
  }
}

/** Text to show for each DAG name in the module selector (literal text or i18n key). */
export function readSchemaLabels(): Record<string, string> {
  const labels = readParameters().schemaLabels
  if (!labels || typeof labels !== 'object' || Array.isArray(labels)) return {}
  return labels as Record<string, string>
}
