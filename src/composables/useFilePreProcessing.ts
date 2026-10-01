/**
 * Runs the deployment's configured `fileProcessors` over an uploaded file and returns a
 * file the backend can read.
 *
 * A processor exists because the raw file is not in a shape any backend endpoint accepts
 * — a matrix with a double header that has to be flattened into records, say. Turning it
 * into something readable is the frontend's job, so every route that sends a file out has
 * to go through here:
 *
 * - the instance load (`POST /external/etl/`), via `useInstanceProcessing`,
 * - the master-data upload (`POST /edit-all-tables/`),
 * - the per-table bulk upload, both its async and its client-parsed branch.
 *
 * Skipping it on one route does not avoid the problem, it just moves the failure: the file
 * reaches the backend in the shape the processor existed to undo.
 *
 * With no `fileProcessors` configured, or when none matches a file, the file is returned
 * untouched.
 */
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import { useFileProcessors } from '@/app/composables/useFileProcessors'
import {
  FILE_EXTENSIONS,
  isExcelExtension,
  getFileExtension,
} from '@cornflow-ui/core/utils/fileConstants'
import { buildExcelBuffer } from '@cornflow-ui/core/utils/data_io'
import { getInstanceSchemaRootForTables } from '@cornflow-ui/core/utils/schemaUtils'

export function useFilePreProcessing() {
  const { t } = useI18n()
  const store = useGeneralStore()
  const { processFileByPrefix, needsSpecialProcessing } = useFileProcessors()

  /** Whether this deployment configures any processor at all. */
  const hasFileProcessors = (): boolean => {
    const fileProcessors = store.appConfig?.parameters?.fileProcessors || {}
    return Object.keys(fileProcessors).length > 0
  }

  const readFile = (
    file: File,
    extension: string,
  ): Promise<string | ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader()
      fileReader.onload = () => resolve(fileReader.result)
      fileReader.onerror = () =>
        reject(
          new Error(
            t('projectExecution.steps.step3.loadInstance.fileReadError'),
          ),
        )
      if (extension === FILE_EXTENSIONS.XLSX) {
        fileReader.readAsArrayBuffer(file)
      } else {
        fileReader.readAsText(file)
      }
    })
  }

  /** Serializes an array of row objects to a CSV string. */
  const serializeToCSV = (rows: Record<string, any>[]): string => {
    if (!rows || rows.length === 0) return ''
    const headers = Object.keys(rows[0])
    const escape = (v: any): string => {
      const s = v === null || v === undefined ? '' : String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replaceAll('"', '""')}"`
        : s
    }
    return [
      headers.join(','),
      ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
    ].join('\n')
  }

  const buildXlsxFile = async (
    data: Record<string, any>,
    filename: string,
  ): Promise<File> => {
    const root =
      getInstanceSchemaRootForTables(store.getSchemaConfig.instanceSchema) ??
      (store.getSchemaConfig.instanceSchema as Record<string, any> | null)
    const { bytes } = await buildExcelBuffer(data, root)
    const blob = new Blob([bytes as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    return new File([blob], filename, { type: blob.type })
  }

  /**
   * Runs the matching processor over one file and re-serialises its result. xlsx/csv keep
   * their extension; anything else becomes xlsx, which every upload endpoint accepts.
   * Returns the file untouched when no processor matches.
   *
   * The processor is handed `store.getSchemaConfig` and decides for itself what to do with
   * it: a processed table is not necessarily declared in the instance schema (it may be
   * master data only), and that choice belongs to the deployment's processor, not here.
   */
  const preProcessFile = async (file: File): Promise<File> => {
    // Cheapest check first: a deployment with no processors configured never reads the
    // file at all, which is the common case.
    if (!hasFileProcessors()) return file
    if (!needsSpecialProcessing(file.name)) return file

    const extension = getFileExtension(file.name)
    const fileContent = await readFile(file, extension)

    const processedInstance = await processFileByPrefix(
      file,
      fileContent,
      extension,
      store.getSchemaConfig,
    )
    if (!processedInstance) return file

    const data = processedInstance.data as Record<string, any>

    if (extension === FILE_EXTENSIONS.CSV) {
      const tableName = file.name.replace(/\.[^.]+$/, '')
      const rows: Record<string, any>[] =
        data[tableName] ?? Object.values(data)[0] ?? []
      const blob = new Blob([serializeToCSV(rows)], { type: 'text/csv' })
      return new File([blob], file.name, { type: 'text/csv' })
    }

    const outputName = isExcelExtension(extension)
      ? file.name
      : file.name.replace(/\.[^.]+$/, '.xlsx')
    return await buildXlsxFile(data, outputName)
  }

  /**
   * Same, over a list. Returns `null` when the deployment configures no processor, so a
   * caller can tell "nothing to do" from "processed, and the result happens to be equal".
   */
  const preProcessFiles = async (files: File[]): Promise<File[] | null> => {
    if (!hasFileProcessors()) return null

    const result: File[] = []
    for (const file of files) {
      result.push(await preProcessFile(file))
    }
    return result
  }

  return { hasFileProcessors, preProcessFile, preProcessFiles }
}
