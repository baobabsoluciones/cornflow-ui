<template>
  <v-app>
    <!--
      Global route progress bar. Shows a thin indeterminate Vuetify bar at the
      very top of the viewport from `router.beforeEach` until `router.afterEach`
      (plus one rAF, so the new view has a chance to mount). Purpose: give the
      user immediate visual feedback when navigating between heavy views (e.g.
      execution list → "Datos de solución"), where the next route's initial
      synchronous render can still take a noticeable amount of time even after
      our perf work.
    -->
    <transition name="route-progress-fade">
      <v-progress-linear
        v-if="isNavigating"
        indeterminate
        color="primary"
        height="3"
        class="route-progress"
      />
    </transition>
    <router-view> </router-view>
    <CoreSnackbar />
    <!--
      Premium modules (enterprise) inject global modals here. Empty when none
      registered. Includes the recalculation "set as current plan" modal, which
      is self-contained and driven by the recalculation store.
    -->
    <component
      v-for="(modal, i) in premiumModals"
      :key="`premium-modal-${i}`"
      :is="modal.component"
      v-bind="modal.props"
    />
  </v-app>
</template>

<script setup lang="ts">
import { computed, provide, ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { snackbar, showSnackbar } from '@cornflow-ui/core/services/SnackbarService'
import { useLocaleReactiveConfigurations } from '@cornflow-ui/core/composables/useLocaleReactiveConfigurations'
import CoreSnackbar from '@cornflow-ui/core/components/core/CoreSnackbar.vue'
import { getPremiumGlobalComponents } from '@cornflow-ui/core/plugins/extensions'

// Provide snackbar state and function globally
provide('snackbar', snackbar)
provide('showSnackbar', showSnackbar)

// Make configurations reactive to locale changes
useLocaleReactiveConfigurations()

// Premium modules (enterprise) global modals. Empty when none registered.
const premiumModals = computed(() => getPremiumGlobalComponents('app-modals'))

// ─── Route progress bar ─────────────────────────────────────────────────────
const router = useRouter()
const isNavigating = ref(false)
/** Tracks the latest navigation so a fast user click doesn't hide the bar mid-transition. */
let navigationToken = 0

const removeBeforeEach = router.beforeEach((to, from) => {
  // Same route, only params/query — skip the bar to avoid flicker.
  if (to.path === from.path) return
  navigationToken++
  isNavigating.value = true
})

const removeAfterEach = router.afterEach(() => {
  const myToken = navigationToken
  // One animation frame so the new route has time to mount; users perceive
  // the bar as "loading until the page is actually there" instead of it
  // vanishing the instant the navigation resolves.
  requestAnimationFrame(() => {
    if (myToken === navigationToken) isNavigating.value = false
  })
})

const removeOnError = router.onError(() => {
  isNavigating.value = false
})

onUnmounted(() => {
  removeBeforeEach()
  removeAfterEach()
  removeOnError()
})
</script>

<style scoped>
.route-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
}

.route-progress-fade-enter-active,
.route-progress-fade-leave-active {
  transition: opacity 0.2s ease-out;
}
.route-progress-fade-enter-from,
.route-progress-fade-leave-to {
  opacity: 0;
}
</style>
