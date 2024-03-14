import { InstanceCore } from "@/models/Instance";

export class Instance extends InstanceCore {

  constructor(
    id: string,
    data: object,
    checks: object,
    schema: string,
  ) {
    super(id, data, checks, schema);
  }
}