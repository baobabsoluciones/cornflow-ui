export class InstanceCore {
  id: string;
  data: object;
  checks: object;
  schema: string;

  constructor(
    id: string,
    data: object,
    checks: object,
    schema: string,
  ) {
    this.data = data;
    this.checks = checks;
    this.schema = schema;
    this.id = id;
  }
}