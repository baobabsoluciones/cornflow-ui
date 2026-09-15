import { hasData, buildModelFromExcel, buildModelFromCsv } from './modelHelpers'
import Ajv, { ErrorObject } from 'ajv'

export class SolutionCore {
  id: string
  data: any
  schema: object
  schemaChecks: object
  schemaName: string
  dataChecks: object
  rawKpis: Record<string, any> | null

  constructor(
    id: string,
    data: any,
    schema: object,
    schemaChecks: object,
    schemaName: string,
    dataChecks: object = {},
    kpis: Record<string, any> | null = null,
  ) {
    this.rawKpis = kpis
    this.data = kpis && Object.keys(kpis).length > 0 ? { ...data, ...kpis } : data
    this.schemaChecks = schemaChecks
    this.schema = schema
    this.schemaName = schemaName
    this.id = id
    this.dataChecks = dataChecks
  }

  async checkSchema(): Promise<ErrorObject<string, Record<string, any>, unknown>[] | undefined> {
    const ajv = new Ajv({ strict: false, allErrors: true })
    const validate = ajv.compile(this.schema)
    const valid = validate(this.data)
    if (!valid) {
      return validate.errors
    }
  }

  hasSolution() {
    return hasData(this.data)
  }

  static fromExcel(file, schema, schemaName) {
    return buildModelFromExcel(this, file, schema, schemaName)
  }

  static fromCsv(csvText, fileName, schema, schemaChecks, schemaName) {
    return buildModelFromCsv(this, csvText, fileName, schema, schemaChecks, schemaName)
  }
}
