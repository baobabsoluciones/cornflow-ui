export class SchemaConfig {
  config: any;
  instanceSchema: any;
  instanceChecksSchema: any;
  solutionSchema: any;
  solutionChecksSchema: any;
  name: string;

  constructor(
    config: any,
    instanceSchema: any,
    instanceChecksSchema: any,
    solutionSchema: any,
    solutionChecksSchema: any,
    name: string,
  ) {
    this.config = config;
    this.instanceSchema = instanceSchema;
    this.instanceChecksSchema = instanceChecksSchema;
    this.solutionSchema = solutionSchema;
    this.name = name;
    this.solutionChecksSchema = solutionChecksSchema;
  }
}