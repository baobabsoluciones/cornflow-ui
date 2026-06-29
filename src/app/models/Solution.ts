import { SolutionCore } from '@cornflow-ui/core/models/Solution'

export class Solution extends SolutionCore {
  constructor(
    id: string,
    data: object[],
    schema: object,
    schemaChecks: object,
    schemaName: string,
    dataChecks: object = {},
  ) {
    super(id, data, schema, schemaChecks, schemaName, dataChecks)
  }
}
