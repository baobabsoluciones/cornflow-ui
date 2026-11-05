/**
 * Reads a solution file (JSON, XLSX or CSV) into the app's `Solution` model, for creating an
 * execution with a solution of its own instead of running the solver (developer mode).
 */
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import {
  FILE_EXTENSIONS,
  getFileExtension,
} from '@cornflow-ui/core/utils/fileConstants'

type Translate = (key: string) => string

export function parseSolutionFile(file: File, t: Translate): Promise<any> {
  const store = useGeneralStore()
  const extension = getFileExtension(file.name)

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async () => {
      try {
        const { Solution } = store.appConfig
        const schemas = store.getSchemaConfig
        const schemaName = store.getSchemaName
        if (extension === FILE_EXTENSIONS.XLSX) {
          resolve(
            await Solution.fromExcel(reader.result, schemas.solutionSchema, schemaName),
          )
        } else if (extension === FILE_EXTENSIONS.JSON) {
          resolve(
            new Solution(
              null,
              JSON.parse(reader.result as string),
              schemas.solutionSchema,
              schemas.solutionChecksSchema,
              schemaName,
            ),
          )
        } else if (extension === FILE_EXTENSIONS.CSV) {
          resolve(
            await Solution.fromCsv(
              reader.result,
              file.name,
              schemas.solutionSchema,
              schemas.solutionChecksSchema,
              schemaName,
            ),
          )
        } else {
          throw new Error(
            t('projectExecution.steps.step8.developerMode.unsupportedFileFormat'),
          )
        }
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () =>
      reject(new Error(t('projectExecution.steps.step8.developerMode.fileReadError')))

    if (extension === FILE_EXTENSIONS.XLSX) reader.readAsArrayBuffer(file)
    else reader.readAsText(file)
  })
}
