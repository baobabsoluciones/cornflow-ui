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

    <div class="marquee-container" v-if="showStagingWarning">
      <Vue3Marquee :pause-on-hover="true">
        🚧 {{ $t('projectExecution.stagingWarning') }} 🚧
      </Vue3Marquee>
    </div>

    <!--
      Premium modules (enterprise) inject global banners here. Empty when none
      registered. Includes the latest-plan "no current plan" banner and the
      recalculation strip (both self-gate via their own stores).
    -->
    <component
      v-for="(banner, i) in premiumBanners"
      :key="`premium-banner-${i}`"
      :is="banner.component"
      v-bind="banner.props"
    />

    <core-app-drawer class="app-drawer" />

    <div
      class="main-content"
      :class="{ 'drawer-pinned': isDrawerPinned }"
      :style="mainContentStyle"
    >
      <core-app-view />
      <div class="tab-container">
        <MAppBarTab
          :key="tabsKey"
          :tabs="enhancedTabsData"
          :createTitle="$t('projectExecution.create')"
          @close="removeTab"
          @create="createTab"
          @select="selectTab"
        >
          <template #actions>
            <div
              class="d-flex align-center"
              style="min-width: 200px !important"
            >
              <v-img height="20" :src="baobabLogoSmall" />
              <div class="mr-2">
                Powered by
                <a href="https://baobabsoluciones.es/" target="_blank"
                  >baobab soluciones</a
                >
              </div>
            </div>
          </template>
        </MAppBarTab>
      </div>
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
import { useRouter, useRoute } from 'vue-router'
import { computed } from 'vue'
import { Vue3Marquee } from 'vue3-marquee'
import config from '@cornflow-ui/core/config'
import appConfig from '@/app/config'
import { baobabLogoSmall } from '@cornflow-ui/core/utils/assets'
import {
  getPremiumGlobalComponents,
  applyPremiumExecutionTabDecorators,
} from '@cornflow-ui/core/plugins/extensions'
import { totalTopBannerOffset } from '@cornflow-ui/core/plugins/layoutOffsets'

const generalStore = useGeneralStore()
const router = useRouter()
const route = useRoute()
let tabsData = computed(() => generalStore.getLoadedExecutionTabs)
let tabsKey = computed(() => generalStore.tabBarKey)
let showStagingWarning = computed(() => config.isStagingEnvironment)
let isDrawerPinned = computed(() => generalStore.isDrawerPinned)
let showInitialLoading = computed(() => generalStore.initialDataLoading)

// Premium modules (enterprise) global banners/FABs. Empty when none registered.
const premiumBanners = computed(() => getPremiumGlobalComponents('app-banners'))
const premiumFabs = computed(() => getPremiumGlobalComponents('app-fabs'))

/**
 * Padding-top reservado para los banners fijos que los módulos premium reportan en el canal
 * de layout (`@/plugins/layoutOffsets`). El core no sabe qué banners hay: solo deja el hueco.
 */
const mainContentStyle = computed(() =>
  totalTopBannerOffset.value
    ? { paddingTop: `${totalTopBannerOffset.value}px` }
    : undefined,
)

// Get the currently selected execution ID
const selectedExecutionId = computed(
  () => generalStore.selectedExecution?.executionId,
)

// Enhance tabs: premium modules (latest-plan ⭐) decorate them via the registry; the core only
// applies the selected state. Without premium modules the tabs pass through unchanged.
const enhancedTabsData = computed(() => {
  const currentSelectedId = selectedExecutionId.value
  const decorated = applyPremiumExecutionTabDecorators(tabsData.value, {
    routeName: route.name,
  })
  return decorated.map((tab) => ({
    ...tab,
    // Ensure selected state is correctly set based on store
    selected: tab.value === currentSelectedId,
  }))
})

// Show FAB whenever there is a selected execution
const hasSelectedExecution = computed(
  () => generalStore.selectedExecution != null,
)

const CORE_INSTANCE_DEPENDENT_ROUTE_PREFIXES = [
  '/input-data',
  '/output-data',
  '/results',
  '/dashboard',
]
const isOnInstanceDependentRoute = (path) => {
  if (
    CORE_INSTANCE_DEPENDENT_ROUTE_PREFIXES.some((prefix) =>
      path.startsWith(prefix),
    )
  ) {
    return true
  }
  return appConfig
    .getInstanceDependentAppRoutePrefixes()
    .some((prefix) => path.startsWith(prefix))
}

defineExpose({
  tabsData,
  tabsKey,
  enhancedTabsData,
  hasSelectedExecution,
})
const removeTab = (index) => {
  generalStore.removeLoadedExecution(index)
}

const createTab = () => {
  router.push({ path: 'project-execution' })
  generalStore.incrementUploadComponentKey()
}

const selectTab = (executionTab) => {
  if (generalStore.selectedExecution?.executionId === executionTab.value) {
    // Deselect if clicking the same tab
    generalStore.setSelectedExecution(null)
    // Set all tabs to not selected
    generalStore.getLoadedExecutionTabs.forEach((tab) => {
      tab.selected = false
    })
    generalStore.incrementTabBarKey()

    const currentRoute = router.currentRoute.value.path
    if (isOnInstanceDependentRoute(currentRoute)) {
      router.push('/history-execution')
    }
  } else {
    // Select the clicked tab
    generalStore.setSelectedExecution(executionTab.value)
    // Set all tabs to not selected, except for the current one
    generalStore.getLoadedExecutionTabs.forEach((tab) => {
      tab.selected = tab.value === executionTab.value
    })
    generalStore.incrementTabBarKey()
  }
}

// Check if user is logged in
if (AuthService.isAuthenticated()) {
  // Launch INITIALIZE_DATA action
  generalStore.initializeData()
}
</script>

<style>
.app-drawer {
  position: fixed !important;
  z-index: 900 !important;
}

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

.tab-container {
  width: 100%;
  display: flex;
  flex-direction: column;
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
}

@media (max-width: 768px) {
  .main-content.drawer-pinned {
    margin-left: 0; /* No margin on mobile - drawer should overlay */
    width: 100%;
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
