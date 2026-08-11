import { watch } from 'vue'
import { locale } from '@cornflow-ui/core/plugins/i18n'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

/**
 * Composable that makes configurations reactive to locale changes
 * This should be used in the main app or root components
 */
export function useLocaleReactiveConfigurations() {
  const generalStore = useGeneralStore()

  // Watch for locale changes and update configurations
  watch(
    locale,
    (newLocale, oldLocale) => {
      // Update localized configurations when locale changes
      // Only update if configurations are already loaded
      if (generalStore.rawConfigurations) {
        generalStore.updateLocalizedConfigurations()
      }
    },
    { immediate: false }, // Don't run immediately since configurations might not be loaded yet
  )

  return {
    locale,
  }
}
