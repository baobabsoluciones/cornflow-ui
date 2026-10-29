<template>
  <v-app>
    <!-- Full-screen loading overlay after login until drawer/configurations are ready -->
    <div
      v-if="showInitialLoading"
      class="initial-loading-overlay"
      data-testid="initial-loading-overlay"
    >
      <div class="initial-loading-content">
        <v-progress-circular indeterminate color="white" size="48" width="4" />
        <p class="initial-loading-text">{{ $t('general.loading') }}</p>
      </div>
    </div>

    <!--
      Top of the layout, fixed, in this order: the top bar, the staging notice and the global
      banners of premium modules. The views start below its height (`--app-top-offset`).
    -->
    <div
      class="app-top-stack"
      :class="{ 'drawer-pinned': isDrawerPinned }"
      data-testid="app-top-stack"
    >
      <!--
        Top bar: what premium modules mount in `app-top-bar`. Only rendered while something in it
        is visible.
      -->
      <div v-if="showTopBar" class="app-top-bar" data-testid="app-top-bar">
        <component
          v-for="(item, i) in premiumTopBar"
          :key="`premium-top-bar-${i}`"
          :is="item.component"
          v-bind="item.props"
        />
      </div>

      <div class="marquee-container" v-if="showStagingWarning">
        <Vue3Marquee :pause-on-hover="true">
          🚧 {{ $t('projectExecution.stagingWarning') }} 🚧
        </Vue3Marquee>
      </div>

      <!--
        Premium modules (enterprise) inject global banners here: the latest-plan "no current plan"
        banner and the recalculation strip (both self-gate via their own stores). They are
        `position: fixed; top: 0`, sized to the viewport; this box is their containing block (it has
        a transform), so they land right below the bar and the staging notice. Its height is the
        one they report on the layout channel.
      -->
      <div
        class="app-top-stack__banners"
        :style="{ height: `${totalTopBannerOffset}px` }"
      >
        <component
          v-for="(banner, i) in premiumBanners"
          :key="`premium-banner-${i}`"
          :is="banner.component"
          v-bind="banner.props"
        />
      </div>
    </div>

    <core-app-drawer class="app-drawer" />

    <div
      class="main-content"
      :class="{ 'drawer-pinned': isDrawerPinned }"
      :style="mainContentStyle"
    >
      <div
        v-if="noSchemaAccess"
        class="no-schema-access"
        data-testid="no-schema-access"
      >
        <v-icon size="48" color="var(--subtitle)">mdi-lock-outline</v-icon>
        <h3>{{ $t('modules.noAccessTitle') }}</h3>
        <p>{{ $t('modules.noAccessMessage') }}</p>
      </div>
      <core-app-view v-else />
      <CoreExecutionTabBar
        class="execution-tabs"
        :tabs="executionTabs"
        :selected="selectedExecutionId ?? null"
        @close="removeTab"
        @select="selectTab"
      >
        <template #end>
          <span class="powered-by">
            <BaobabMark class="powered-by__logo" />
            Powered by
            <a href="https://baobabsoluciones.es/" target="_blank" rel="noopener">baobab soluciones</a>
          </span>
        </template>
      </CoreExecutionTabBar>
    </div>

    <!--
      Premium modules (enterprise) inject global FABs here. Empty when none
      registered. Includes the latest-plan "set current plan" FAB (self-gates
      via its own store and the current route).
    -->
    <component
      v-for="(fab, i) in premiumFabs"
      :key="`premium-fab-${i}`"
      :is="fab.component"
      v-bind="fab.props"
    />
  </v-app>
</template>

<script setup>
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import AuthService from '@cornflow-ui/core/services/AuthService'
import CoreAppDrawer from '@cornflow-ui/core/components/AppDrawer.vue'
import CoreAppView from '@cornflow-ui/core/components/AppView.vue'
import CoreExecutionTabBar from '@cornflow-ui/core/components/ExecutionTabBar.vue'
import { useRouter, useRoute } from 'vue-router'
import { computed } from 'vue'
import { Vue3Marquee } from 'vue3-marquee'
import config from '@cornflow-ui/core/config'
import BaobabMark from '@cornflow-ui/core/components/BaobabMark.vue'
import {
  getPremiumGlobalComponents,
  applyPremiumExecutionTabDecorators,
} from '@cornflow-ui/core/plugins/extensions'
import { totalTopBannerOffset } from '@cornflow-ui/core/plugins/layoutOffsets'
import { isOnInstanceDependentRoute } from '@cornflow-ui/core/utils/instanceDependentRoutes'
import { useExecutionStatus } from '@cornflow-ui/core/composables/project-execution/useExecutionStatus'

/** Heights (px) of the fixed top stack's own parts (premium banners report theirs). */
const APP_TOP_BAR_HEIGHT = 56
const STAGING_NOTICE_HEIGHT = 40

const generalStore = useGeneralStore()
const router = useRouter()
const route = useRoute()
const { displayStatus } = useExecutionStatus()
let showStagingWarning = computed(() => config.isStagingEnvironment)
let isDrawerPinned = computed(() => generalStore.isDrawerPinned)
let showInitialLoading = computed(() => generalStore.initialDataLoading)

// Premium modules (enterprise) global banners/FABs. Empty when none registered.
const premiumBanners = computed(() => getPremiumGlobalComponents('app-banners'))
const premiumFabs = computed(() => getPremiumGlobalComponents('app-fabs'))
const premiumTopBar = computed(() => getPremiumGlobalComponents('app-top-bar'))

const showTopBar = computed(() => premiumTopBar.value.length > 0)
const noSchemaAccess = computed(() => generalStore.noSchemaAccess)

/**
 * Height of the fixed top stack: the top bar, the staging notice and the banners premium
 * modules report on the layout channel (`@/plugins/layoutOffsets`; the core doesn't know which
 * banners exist, it just leaves the gap). The views start below it: `.main-content` gets it as
 * padding-top and `--app-top-offset` lets the views (`main.css`) fit the viewport.
 */
const topStackHeight = computed(
  () =>
    (showTopBar.value ? APP_TOP_BAR_HEIGHT : 0) +
    (showStagingWarning.value ? STAGING_NOTICE_HEIGHT : 0) +
    totalTopBannerOffset.value,
)
const mainContentStyle = computed(() =>
  topStackHeight.value
    ? {
        paddingTop: `${topStackHeight.value}px`,
        '--app-top-offset': `${topStackHeight.value}px`,
      }
    : undefined,
)

// Get the currently selected execution ID
const selectedExecutionId = computed(
  () => generalStore.selectedExecution?.executionId,
)

// A tab per loaded execution, with the state the app shows for it. Premium modules (the ⭐ of the
// latest plan) decorate them first; without premium modules they pass through unchanged.
const executionTabs = computed(() =>
  applyPremiumExecutionTabDecorators(generalStore.getLoadedExecutionTabs, {
    routeName: route.name,
  }).map((tab) => {
    const status = displayStatus(tab.state, tab.solutionStatusCode)
    return {
      id: tab.value,
      name: tab.text,
      status: { label: status.label, tone: status.tone, spin: status.spin },
    }
  }),
)

// Show FAB whenever there is a selected execution
const hasSelectedExecution = computed(
  () => generalStore.selectedExecution != null,
)

defineExpose({
  executionTabs,
  hasSelectedExecution,
})
const removeTab = (index) => {
  generalStore.removeLoadedExecution(index)
}

// Clicking the selected tab deselects it, and leaves a view that needs an execution.
const selectTab = (executionId) => {
  if (generalStore.selectedExecution?.executionId !== executionId) {
    generalStore.setSelectedExecution(executionId)
    return
  }
  generalStore.setSelectedExecution(null)
  if (isOnInstanceDependentRoute(router.currentRoute.value.path)) {
    router.push('/history-execution')
  }
}

// Check if user is logged in
if (AuthService.isAuthenticated()) {
  // Launch INITIALIZE_DATA action
  generalStore.initializeData()
}
</script>

<style>
.main-content {
  transition: margin-left 0.3s ease;
  margin-left: 0;
  width: 100%;
  min-height: 100vh;
  padding: 0;
}

.main-content.drawer-pinned {
  margin-left: 250px; /* Width of the expanded drawer */
  width: calc(100% - 250px); /* Adjust width to account for drawer */
  max-width: calc(100% - 250px); /* Prevent overflow */
  overflow-x: hidden; /* Prevent horizontal scroll */
}

/* The execution tab bar, at the foot, starts where the side menu ends: the rail, or the pinned menu. */
.execution-tabs {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 56px;
  z-index: 900;
  transition: left 0.3s ease;
}

.main-content.drawer-pinned .execution-tabs {
  left: 250px;
}

.powered-by {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.powered-by__logo {
  height: 18px;
  width: auto;
  color: var(--color-baobab-mark);
}

/*
  Fixed top stack: full width under the drawer (which stays on top of it), so the staging notice
  and the premium banners keep spanning the window as they always have.
*/
.app-top-stack {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 850;
}

/* Containing block of the premium banners' `position: fixed` (see the template) */
.app-top-stack__banners {
  position: relative;
  transform: translateZ(0);
}

/* Top bar: a light band tinted with the app's primary colour, its content clear of the drawer */
.app-top-bar {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 40px 0 96px; /* 56px mini drawer + the views' 40px gutter */
  overflow: hidden;
  color: var(--title);
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.6) 0%,
      rgba(255, 255, 255, 0) 100%
    ),
    color-mix(in srgb, var(--primary) 14%, #fff);
  border-bottom: 1px solid color-mix(in srgb, var(--primary) 18%, #fff);
  box-shadow: 0 4px 14px rgba(16, 24, 40, 0.08);
}

.app-top-stack.drawer-pinned .app-top-bar {
  padding-left: 290px; /* 250px pinned drawer + 40px */
}

.no-schema-access {
  min-height: calc(100vh - var(--bottom-bar-height) - var(--app-top-offset, 0px));
  margin-left: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--subtitle);
  text-align: center;
}

.main-content.drawer-pinned .no-schema-access {
  margin-left: 0;
}

.marquee-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  height: 40px;
  background-color: #ffe6e6;
  padding: 5px;
  color: #000;
  border-bottom: 2px solid #ffcccc;
  font-weight: bold;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Override Vuetify default padding/margin */
.v-application {
  padding: 0 !important;
}

.v-main {
  padding: 0 !important;
}

/* Ensure no body/html margins */
html,
body {
  margin: 0 !important;
  padding: 0 !important;
  overflow-x: hidden;
}

/* Ensure v-app takes full width */
.v-app {
  width: 100% !important;
  max-width: 100% !important;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .main-content.drawer-pinned {
    margin-left: 200px; /* Smaller margin on smaller screens */
    width: calc(100% - 200px);
    max-width: calc(100% - 200px);
  }

  .app-top-stack.drawer-pinned .app-top-bar {
    padding-left: 240px;
  }
}

@media (max-width: 768px) {
  .main-content.drawer-pinned {
    margin-left: 0; /* No margin on mobile - drawer should overlay */
    width: 100%;
  }

  .app-top-stack.drawer-pinned .app-top-bar {
    padding-left: 96px;
  }

  .main-content.drawer-pinned .execution-tabs {
    left: 56px;
  }
}

/* Full-screen loading overlay after login (above drawer) */
.initial-loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 950;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}

.initial-loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.initial-loading-text {
  margin: 0;
  font-size: 1rem;
  color: #fff;
}
</style>
