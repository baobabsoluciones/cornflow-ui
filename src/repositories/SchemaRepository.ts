import client from '@cornflow-ui/core/api/Api'
import { SchemaConfig } from '@cornflow-ui/core/models/SchemaConfig'
import { transformJsonSchemaToAutomationFormat } from '@cornflow-ui/core/utils/schemaUtils'

export default class SchemaRepository {
  // Get schema for the app
  async getSchema(name: string): Promise<SchemaConfig> {
    const response = await client.get(`/schema/${name}/`)

    if (response.status === 200) {
      const schema = response.content
      return new SchemaConfig(
        schema.config,
        schema.instance,
        schema.instance_checks,
        schema.solution,
        schema.solution_checks,
        schema.name,
      )
    } else {
      throw new Error('Error getting schema')
    }
  }

  // Get instance data tables from schema
  async getInstanceTables(schemaName: string): Promise<any> {
    const schema = await this.getSchema(schemaName)
    return this.transformSchemaToAutomationFormat(
      schema.instanceSchema,
      schema.instanceChecksSchema,
      'instance',
    )
  }

  // Get solution data tables from schema
  async getSolutionTables(schemaName: string): Promise<any> {
    const schema = await this.getSchema(schemaName)
    return this.transformSchemaToAutomationFormat(
      schema.solutionSchema,
      schema.solutionChecksSchema,
      'solution',
    )
  }

  /**
   * Transform JSON schema to automation format
   * @param schema - The JSON schema (instance or solution)
   * @param checksSchema - The checks schema (instance_checks or solution_checks)
   * @param type - The type ('instance' or 'solution')
   * @returns Transformed table configuration
   */
  private transformSchemaToAutomationFormat(
    schema: any,
    checksSchema: any,
    type: string,
  ): any {
    if (!schema) return {}

    return transformJsonSchemaToAutomationFormat(schema, checksSchema, type)
  }
}
