import { schemaDataToTable } from '@/utils/data_io'
import { InstanceCore } from './Instance'
import { SolutionCore } from './Solution'

import * as ExcelJS from 'exceljs'

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
    const sanitizedFilename = filename.replace(/\./g, '-')

    // we create the object for the file
    let workbook

    // we write the "header tables" from schema

    // then we write the instance tables
    if (saveInstance && this.instance != null && this.instance.data != null) {
      workbook = new ExcelJS.Workbook()
      schemaDataToTable(workbook, this.instance.data, this.instance.schema)
      // we generate the excel file
      const excelBuffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.download = `instance_${sanitizedFilename}`
      link.click()
    }
    if (saveSolution && this.solution != null && this.solution.data != null) {
      workbook = new ExcelJS.Workbook()
      schemaDataToTable(workbook, this.solution.data, this.solution.schema)
      // we generate the excel file
      const excelBuffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.download = `solution_${sanitizedFilename}`
      link.click()
    }
  }
}
