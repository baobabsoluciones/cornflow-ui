import { InstanceCore } from '@/models/Instance'

export class Instance extends InstanceCore {
  constructor(
    id: string,
    data: object,
    schema: object,
    schemaChecks: object,
    schemaName: string,
    dataChecks: object[] = [],
  ) {
    super(id, data, schema, schemaChecks, schemaName, dataChecks)
  }
}
