import { loadExcel } from '../utils/data_io'
import Ajv from 'ajv'

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

  checkSchema() {
    const ajv = new Ajv({ strict: false, allErrors: true })
    const validate = ajv.compile(this.schema)
    const valid = validate(this.data)
    if (!valid) {
      return validate.errors
    }
  }

  static fromExcel(file, schema, schemaName) {
    return loadExcel(file, schema).then(
      (data) => new this(null, data, schema, {}, schemaName),
    )
  }
}
