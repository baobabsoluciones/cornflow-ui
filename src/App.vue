<template>
  <v-app>
    <router-view> </router-view>
    <MSnackbar />
  </v-app>
</template>

<script>
import { provide } from 'vue'
import { snackbar, showSnackbar } from '@/services/SnackbarService.ts'
import { useLocaleReactiveConfigurations } from '@/composables/useLocaleReactiveConfigurations'

export default {
  components: {},
  setup() {
    provide('snackbar', snackbar)
    provide('showSnackbar', showSnackbar)

    // Make configurations reactive to locale changes
    useLocaleReactiveConfigurations()
  },
}
</script>
