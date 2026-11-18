import client from '@cornflow-ui/core/api/Api'
import { SchemaConfig } from '@cornflow-ui/core/models/SchemaConfig'

export default class SchemaRepository {
  /**
   * Names of the DAGs the current user may use (`GET /schema/`). Cornflow answers from the user's
   * DAG permissions, so the list only narrows down when the deployment restricts them.
   */
  async getAvailableSchemaNames(): Promise<string[]> {
    const response = await client.get('/schema/')

    if (response.status === 200 && Array.isArray(response.content)) {
      return response.content
        .map((entry: { name?: unknown }) => entry?.name)
        .filter((name: unknown): name is string => typeof name === 'string')
    }
    throw new Error('Error getting available schemas')
  }

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
}
