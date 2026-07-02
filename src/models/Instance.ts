import { hasData, buildModelFromExcel, buildModelFromCsv } from './modelHelpers'
import Ajv, { ErrorObject } from 'ajv'

export class InstanceCore {
  id: string | null
  data: object
  schema: object
  schemaChecks: object
  schemaName: string
  dataChecks: object

  constructor(
    id: string,
    data: object,
    schema: object,
    schemaChecks: object,
    schemaName: string,
    dataChecks: object = {},
  ) {
    this.id = id
    this.data = data
    this.schema = schema
    this.schemaChecks = schemaChecks
    this.schemaName = schemaName
    this.dataChecks = dataChecks
  }

  async checkSchema(): Promise<ErrorObject<string, Record<string, any>, unknown>[] | undefined> {
    const ajv = new Ajv({ strict: false, allErrors: true, coerceTypes: true })
    const validate = ajv.compile(this.schema)
    const valid = validate(this.data)
    if (!valid) {
      return validate.errors
    }
  }

  hasInstance() {
    return hasData(this.data)
  }

  static fromExcel(file, schema, schemaName) {
    return buildModelFromExcel(this, file, schema, schemaName)
  }

  static fromCsv(csvText, fileName, schema, schemaChecks, schemaName) {
    return buildModelFromCsv(this, csvText, fileName, schema, schemaChecks, schemaName)
  }
}
