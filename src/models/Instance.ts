import { loadExcel } from '../utils/data_io'
import Ajv from 'ajv'

export class InstanceCore {
  id: string | null
  data: object
  schemaChecks: object
  schema: string
  dataChecks: object[]

  constructor(
    id: string,
    data: object,
    schemaChecks: object,
    schema: string,
    dataChecks: object[] = [],
  ) {
    this.data = data
    this.schemaChecks = schemaChecks
    this.schema = schema
    this.id = id
    this.dataChecks = dataChecks
  }

  checkSchema() {
    const ajv = new Ajv({ strict: false, allErrors: true })
    const validate = ajv.compile(this.schemaChecks)
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
