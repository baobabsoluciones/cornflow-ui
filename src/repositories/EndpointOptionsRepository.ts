import client from '@cornflow-ui/core/api/Api'
import type {
  EndpointOption,
  EndpointOptionsSource,
} from '@cornflow-ui/core/types/endpointOptions'

export default class EndpointOptionsRepository {
  /**
   * Options of a selector for the current user. The endpoint decides which options the user may
   * pick; the core only shows them.
   */
  async getOptions(
    source: EndpointOptionsSource,
    queryParams: Record<string, string>,
  ): Promise<EndpointOption[]> {
    const response = await client.get(
      source.optionsEndpoint,
      queryParams,
      {},
      source.isExternal === true,
    )

    if (response.status !== 200 || !Array.isArray(response.content)) {
      throw new Error(`Error getting the options of ${source.optionsEndpoint}`)
    }

    const labelField = source.labelField || source.valueField
    return response.content
      .filter(
        (row: Record<string, unknown>) => row && row[source.valueField] != null,
      )
      .map((row: Record<string, unknown>) => {
        const value = row[source.valueField]
        const label = row[labelField]
        return {
          value,
          title: label == null || label === '' ? String(value) : String(label),
        }
      })
  }
}
