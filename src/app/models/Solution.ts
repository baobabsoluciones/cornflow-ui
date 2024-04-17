import { SolutionCore } from '@/models/Solution'

export class Solution extends SolutionCore {
  constructor(
    id: string,
    data: object,
    schemaChecks: object,
    schema: string,
    dataChecks: object[] = [],
  ) {
    super(id, data, schemaChecks, schema, dataChecks)
  }
}
