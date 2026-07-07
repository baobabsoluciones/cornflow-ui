import client from '@cornflow-ui/core/api/Api'
import type {
  AutomationSectionDef,
  AutomationGroupDef,
} from '@cornflow-ui/core/types/frontendAutomation'
import { transformOpenApiToTableConfig } from '@cornflow-ui/core/modules/frontend-automation/openApiTransform'

/**
 * Repositorio de la feature premium FRONTEND-AUTOMATION.
 *
 * Carve de `repositories/SchemaRepository.ts`: aquí vive la carga de master-data desde el
 * endpoint `/frontend-automation/` (tablas configurables + secciones/grupos del drawer).
 * El core la consume vía el punto de extensión `loadMasterDataConfig` (no conoce este repo).
 */
export default class FaRepository {
  /**
   * Get configuration tables (master data), sections and groups from frontend-automation.
   * Sections and groups are returned sorted by their `order` (integer); they are shown in that order in the drawer.
   */
  async getConfigurationTables(): Promise<{
    config: any
    sections: AutomationSectionDef[]
    groups: AutomationGroupDef[]
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

  /**
   * Process the frontend-automation response and transform it to our internal format.
   * Sections and groups are returned sorted by their `order` field.
   *
   * @param automationData - The raw response from frontend-automation endpoint
   * @returns Object with config, sections (sorted by order) and groups (sorted by order)
   */
  private processAutomationResponse(automationData: any): {
    config: any
    sections: AutomationSectionDef[]
    groups: AutomationGroupDef[]
  } {
    // Validate the response structure
    if (!automationData?.available_automations) {
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

    const { config, sections, groups } =
      transformOpenApiToTableConfig(processedData)
    return { config, sections, groups }
  }
}
