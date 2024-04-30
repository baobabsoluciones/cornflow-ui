export class SolutionCore {
  id: string
  data: object[]
  schema: object
  schemaChecks: object
  schemaName: string
  dataChecks: object

  constructor(
    id: string,
    data: object[],
    schema: object,
    schemaChecks: object,
    schemaName: string,
    dataChecks: object = {},
  ) {
    this.data = data
    this.schemaChecks = schemaChecks
    this.schema = schema
    this.schemaName = schemaName
    this.id = id
    this.dataChecks = dataChecks
  }

  hasSolution() {
    return this.data !== undefined && this.data !== null && this.data.length > 0
  }
}
