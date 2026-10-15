import client from '@cornflow-ui/core/api/Api'
import type {
  GlobalContextDimension,
  GlobalContextOption,
} from '@cornflow-ui/core/types/globalContext'

export default class GlobalContextRepository {
  /**
   * Options of one global-context dimension for the current user. The endpoint decides which
   * options the user may pick; the core only shows them.
   */
  async getOptions(
    dimension: GlobalContextDimension,
    queryParams: Record<string, string>,
  ): Promise<GlobalContextOption[]> {
    const response = await client.get(
      dimension.optionsEndpoint,
      queryParams,
      {},
      dimension.isExternal === true,
    )

    if (response.status !== 200 || !Array.isArray(response.content)) {
      throw new Error(`Error getting the options of ${dimension.key}`)
    }

    const labelField = dimension.labelField || dimension.valueField
    return response.content
      .filter(
        (row: Record<string, unknown>) =>
          row && row[dimension.valueField] != null,
      )
      .map((row: Record<string, unknown>) => {
        const value = row[dimension.valueField]
        const label = row[labelField]
        return {
          value,
          title: label == null || label === '' ? String(value) : String(label),
        }
      })
  }
}
