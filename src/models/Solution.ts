export class SolutionCore {
  id: string
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
}
