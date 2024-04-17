import { InstanceCore } from '@/models/Instance'

export class Instance extends InstanceCore {
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
