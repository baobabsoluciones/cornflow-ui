import { buildExcelBuffer, type ExcelBuildResult } from '@/utils/data_io'
import { InstanceCore } from './Instance'
import { SolutionCore } from './Solution'

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const ZIP_MIME = 'application/zip'

function triggerBuiltDownload(
  result: ExcelBuildResult,
  baseName: string,
): void {
  const mime = result.format === 'zip' ? ZIP_MIME : XLSX_MIME
  const filename = `${baseName}.${result.format}`
  const blob = new Blob([result.bytes as BlobPart], { type: mime })
  const url = globalThis.window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  globalThis.window.URL.revokeObjectURL(url)
}

export class ExperimentCore {
  instance: InstanceCore
  solution: SolutionCore

  constructor(instance: InstanceCore, solution: SolutionCore) {
    this.instance = instance
    this.solution = solution
  }

  hasSolution() {
    return this.solution.hasSolution()
  }

  hasInstance() {
    return this.instance.hasInstance()
  }

  async downloadExcel(
    filename = 'execution',
    saveInstance = true,
    saveSolution = true,
  ) {
    // Sanitize the filename by replacing points with hyphens
    const sanitizedFilename = filename.replaceAll('.', '-')

    if (saveInstance && this.instance?.data != null) {
      // Serialise the instance off the main thread via the Excel worker for
      // small/medium datasets; huge ones fall back to a streaming CSV-ZIP
      // path. `buildExcelBuffer` decides which one to use and tells us via
      // `format` so the file gets the right extension.
      const result = await buildExcelBuffer(
        this.instance.data as Record<string, any>,
        this.instance.schema as Record<string, any> | null,
      )
      triggerBuiltDownload(result, `instance_${sanitizedFilename}`)
    }
    if (saveSolution && this.solution?.data != null) {
      const result = await buildExcelBuffer(
        this.solution.data as Record<string, any>,
        this.solution.schema as Record<string, any> | null,
      )
      triggerBuiltDownload(result, `solution_${sanitizedFilename}`)
    }
  }

  /**
   * Download checks (validations) as Excel. Shared logic for instance and solution checks.
   * @param dataChecks - Record of table key to rows (instance or solution dataChecks)
   * @param schemaChecks - Schema for the checks tables
   * @param filename - Base filename (will be sanitized and prefixed)
   * @param downloadPrefix - Prefix for the downloaded file (e.g. 'instance_checks' or 'solution_checks')
   * @param noDataError - Error message when data is missing
   */
  async downloadChecksExcel(
    dataChecks: Record<string, any>,
    schemaChecks: Record<string, any> | null,
    filename: string,
    downloadPrefix: string,
    noDataError: string,
  ) {
    const sanitized = filename.replaceAll('.', '-')
    if (!dataChecks || typeof dataChecks !== 'object') {
      throw new Error(noDataError)
    }
    const result = await buildExcelBuffer(dataChecks, schemaChecks)
    triggerBuiltDownload(result, `${downloadPrefix}_${sanitized}`)
  }

  /**
   * Download instance checks (validations) as Excel. Used when in Validaciones in input-data.
   * Available for all projects using ExperimentCore.
   */
  async downloadInstanceChecksExcel(filename: string = 'instance_checks') {
    if (!this.instance?.dataChecks) {
      throw new Error('No instance checks data')
    }
    await this.downloadChecksExcel(
      this.instance.dataChecks as Record<string, any>,
      (this.instance.schemaChecks as Record<string, any>) || null,
      filename,
      'instance_checks',
      'No instance checks data',
    )
  }

  /**
   * Download solution checks (validations) as Excel. Used when in Validaciones in results.
   * Available for all projects using ExperimentCore.
   */
  async downloadSolutionChecksExcel(filename: string = 'solution_checks') {
    if (!this.solution?.dataChecks) {
      throw new Error('No solution checks data')
    }
    await this.downloadChecksExcel(
      this.solution.dataChecks as Record<string, any>,
      (this.solution.schemaChecks as Record<string, any>) || null,
      filename,
      'solution_checks',
      'No solution checks data',
    )
  }
}
