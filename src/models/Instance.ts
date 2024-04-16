import { loadExcel } from '../utils/data_io'
import Ajv from 'ajv'

export class InstanceCore {
  id: string | null
  data: object
  checks: object
  schema: string

  constructor(id: string, data: object, checks: object, schema: string) {
    this.data = data
    this.checks = checks
    this.schema = schema
    this.id = id
  }

  checkSchema() {
    const ajv = new Ajv({ strict: false, allErrors: true })
    const validate = ajv.compile(this.checks)
    const valid = validate(this.data)
    if (!valid) {
      return validate.errors
    }
  }

  static fromExcel(file, schema, schemaName) {
    return loadExcel(file, schema).then(
      (data) => new this(null, data, schema, schemaName),
    )
  }
}
