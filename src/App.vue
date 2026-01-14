<template>
  <v-app>
    <router-view> </router-view>
    <CoreSnackbar />
  </v-app>
</template>

<script setup lang="ts">
import { provide } from 'vue'
import { snackbar, showSnackbar } from '@/services/SnackbarService'
import { useLocaleReactiveConfigurations } from '@/composables/useLocaleReactiveConfigurations'
import CoreSnackbar from '@/components/core/CoreSnackbar.vue'

// Provide snackbar state and function globally
provide('snackbar', snackbar)
provide('showSnackbar', showSnackbar)

// Make configurations reactive to locale changes
useLocaleReactiveConfigurations()
</script>
