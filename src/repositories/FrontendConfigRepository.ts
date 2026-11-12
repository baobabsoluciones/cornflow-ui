import client from '@cornflow-ui/core/api/Api'
import type { FrontendConfig } from '@cornflow-ui/core/utils/frontendConfig'

export default class FrontendConfigRepository {
  /** `GET /external/frontend-config/`: what the backend tells the interface about each DAG. */
  async getFrontendConfig(): Promise<FrontendConfig> {
    const response = await client.get('/frontend-config/', {}, {}, true)
    if (
      response.status === 200 &&
      response.content &&
      typeof response.content === 'object'
    ) {
      return response.content as FrontendConfig
    }
    throw new Error(`Failed to fetch the frontend config (${response.status})`)
  }
}
