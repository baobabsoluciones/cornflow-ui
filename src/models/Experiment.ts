import { schemaDataToTable } from '@/utils/data_io'
import { InstanceCore } from './Instance'
import { SolutionCore } from './Solution'

import ExcelJS from 'exceljs';

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

  async downloadExcel (
    filename = 'none',
    saveInstance = true,
    saveSolution = true,
  ) {

    // we create the object for the file
    var workbook;

    // we write the "header tables" from schema

    // then we write the instance tables
    if (saveInstance && this.instance != null) {
      workbook = new ExcelJS.Workbook()
      schemaDataToTable(workbook, this.instance.data)
       // we generate the excel file
        const excelBuffer = await workbook.xlsx.writeBuffer()
        const blob = new Blob([excelBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        const link = document.createElement('a')
        link.href = window.URL.createObjectURL(blob)
        link.download = 'instance'
        link.click()
        console.log('Excel file generated correctly:', 'instance')
    }
    if (saveSolution && this.solution != null) {
      workbook = new ExcelJS.Workbook()
      schemaDataToTable(workbook, this.solution.data)
       // we generate the excel file
        const excelBuffer = await workbook.xlsx.writeBuffer()
        const blob = new Blob([excelBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        const link = document.createElement('a')
        link.href = window.URL.createObjectURL(blob)
        link.download = 'solution'
        link.click()
        console.log('Excel file generated correctly: solution')
    }
    
  }
}
