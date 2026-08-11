import { useI18n } from 'vue-i18n'
import appConfig from '@/app/config'

/**
 * Composable for getting section titles with support for custom app-specific titles.
 *
 * This composable checks the app configuration for custom section title keys.
 * If a custom key is defined, it uses that translation.
 * Otherwise, it falls back to the default navigation translations.
 *
 * Custom titles can be configured in src/app/config.ts under parameters.sectionTitles
 * and translations should be added in src/app/plugins/locales/*.ts under sectionTitles
 */
export function useSectionTitles() {
  const { t, te } = useI18n()

  /**
   * Get the section title configuration from app config
   */
  const getSectionTitlesConfig = () => {
    return appConfig.getCore()?.parameters?.sectionTitles || {}
  }

  /**
   * Get the title for a specific section
   * @param section - The section key: 'executions', 'masterData', 'inputData', or 'results'
   * @returns The translated title for the section
   */
  const getSectionTitle = (
    section: 'executions' | 'masterData' | 'inputData' | 'results',
  ): string => {
    const config = getSectionTitlesConfig()
    const customKey = config[section]

    // If a custom i18n key is configured, try to use it
    if (customKey && typeof customKey === 'string') {
      // Check if the custom key exists
      if (te(customKey)) {
        return t(customKey)
      }
    }

    // Try app-specific sectionTitles first (allows per-app customization without changing config)
    // App locales are merged directly into the main messages (no 'app.' prefix)
    const appKey = `sectionTitles.${section}`
    if (te(appKey)) {
      return t(appKey)
    }

    // Fall back to default navigation translations
    const defaultKey = `navigation.${section}`
    return t(defaultKey)
  }

  /**
   * Get all section titles as an object
   */
  const getAllSectionTitles = () => ({
    executions: getSectionTitle('executions'),
    masterData: getSectionTitle('masterData'),
    inputData: getSectionTitle('inputData'),
    results: getSectionTitle('results'),
  })

  return {
    getSectionTitle,
    getAllSectionTitles,
  }
}

