import { loadExcel } from '../utils/data_io'
import { parseCsvToData } from '../utils/csvUtils'
import Ajv from 'ajv'
import { ErrorObject } from 'ajv'

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
    const ajv = new Ajv({ strict: false, allErrors: true })
    const validate = ajv.compile(this.schema)
    const valid = validate(this.data)
    if (!valid) {
      return validate.errors
    }
  }

  hasInstance() {
    return (
      this.data !== undefined &&
      this.data !== null &&
      Object.keys(this.data).length > 0
    )
  }

  static fromExcel(file, schema, schemaName) {
    return loadExcel(file, schema).then(
      (data) => new this(null, data, schema, {}, schemaName),
    )
  }
  
  static fromCsv(csvText, fileName, schema, schemaChecks, schemaName) {
    return new Promise((resolve, reject) => {
      try {
        const { data } = parseCsvToData(csvText, fileName)
        resolve(new this(null, data, schema, schemaChecks, schemaName))
      } catch (error) {
        reject(error)
      }
    })
  }
}
