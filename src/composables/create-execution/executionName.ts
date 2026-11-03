/**
 * The name the new execution gets when the data is loaded, so that launching needs no typing.
 * The user can change it; an app can replace the rule with `createExecution.proposeName` in its
 * `src/app/config.ts`.
 */

import { formatDay } from '@cornflow-ui/core/utils/date'

export interface ProposeNameContext {
  /** Names of the files the data was loaded from, in the order they were picked. */
  fileNames: string[]
  /** Text of the load filters that were set (e.g. the picked option of each). */
  filterLabels: string[]
  /** Name of the execution the data was copied from, when relaunching one. */
  fromExecution: string | null
  /** When the data was loaded. */
  date: Date
  /** The app's language, for the date. */
  locale: string
  t: (key: string, params?: Record<string, unknown>) => string
}

export type ProposeExecutionName = (context: ProposeNameContext) => string

/** "datos_semana-43.xlsx" → "Datos semana 43". */
export function humanizeFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : ''
}

/**
 * The first file's name, or "Data of <date>" when the data came from the database; followed by
 * the load filters. A relaunch keeps the original name and says it has changes.
 */
export const proposeExecutionName: ProposeExecutionName = ({
  fileNames,
  filterLabels,
  fromExecution,
  date,
  locale,
  t,
}) => {
  if (fromExecution) {
    return t('createExecution.name.relaunch', { name: fromExecution })
  }
  const base =
    (fileNames[0] && humanizeFileName(fileNames[0])) ||
    t('createExecution.name.fromDatabase', { date: formatDay(date, locale) })
  return [base, ...filterLabels.filter(Boolean)].join(' · ')
}
