import client from '@/api/Api'
import { SchemaConfig } from '@/models/SchemaConfig'
import {
  transformOpenApiToTableConfig,
  transformJsonSchemaToAutomationFormat,
} from '@/utils/schemaUtils'

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

  /**
   * Get configuration tables (master data) and optional sections from frontend-automation.
   * When the schema defines available_automations.sections, sections are returned in order;
   * they are shown above the default "Master data" block in the drawer.
   */
  async getConfigurationTables(schemaName: string): Promise<{
    config: any
    sections: Array<{ id: string; title: Record<string, string> | string; icon?: string }>
  }> {
    const response = await client.get(`/frontend-automation/`, {}, {}, true)

    if (response.status === 200) {
      return this.processAutomationResponse(response.content)
    } else {
      throw new Error(
        `Failed to get configuration tables. Status: ${response.status}`,
      )
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
   * Process the frontend-automation response and transform it to our internal format.
   * When available_automations.sections exists, sections are returned and tables include a section id;
   * schema sections are shown above the default "Master data" block in the drawer.
   *
   * @param automationData - The raw response from frontend-automation endpoint
   * @returns Object with config (table configuration) and sections (section definitions, in order)
   */
  private processAutomationResponse(automationData: any): {
    config: any
    sections: Array<{ id: string; title: Record<string, string> | string; icon?: string }>
  } {
    // Validate the response structure
    if (!automationData || !automationData.available_automations) {
      throw new Error('Invalid automation data structure')
    }

    const { available_automations, definitions, paths } = automationData

    // Ensure we have the required sections
    if (!available_automations.tables || !definitions) {
      throw new Error('Missing required sections in automation data')
    }

    // Create the structure expected by transformOpenApiToTableConfig (include sections)
    const processedData = {
      available_automations: {
        tables: available_automations.tables,
        groups: available_automations.groups || {},
        sections: available_automations.sections || {},
      },
      definitions,
      paths: paths || {},
    }

    const { config, sections } = transformOpenApiToTableConfig(processedData)
    return { config, sections }
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
