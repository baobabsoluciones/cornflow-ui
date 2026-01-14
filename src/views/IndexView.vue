<template>
  <v-app>
    <!-- Latest plan banner -->
    <LatestPlanBanner />

    <div class="marquee-container" v-if="showStagingWarning">
      <Vue3Marquee :pause-on-hover="true">
        🚧 {{ $t('projectExecution.stagingWarning') }} 🚧
      </Vue3Marquee>
    </div>
    <core-app-drawer class="app-drawer" />
    <div
      class="main-content"
      :class="{
        'drawer-pinned': isDrawerPinned,
        'has-banner': showLatestPlanBanner,
      }"
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

    <!-- Floating button to set current execution as latest plan (only visible in execution-related views) -->
    <SetCurrentPlanFab v-if="isExecutionRelatedView" />
  </v-app>
</template>

<script setup>
import { useGeneralStore } from '@/stores/general'
import AuthService from '@/services/AuthService'
import CoreAppDrawer from '@/components/AppDrawer.vue'
import CoreAppView from '@/components/AppView.vue'
import LatestPlanBanner from '@/components/LatestPlanBanner.vue'
import SetCurrentPlanFab from '@/components/SetCurrentPlanFab.vue'
import { useRouter, useRoute } from 'vue-router'
import { computed } from 'vue'
import { Vue3Marquee } from 'vue3-marquee'
import config from '@/config'
import { baobabLogoSmall } from '@/utils/assets'

const generalStore = useGeneralStore()
const router = useRouter()
const route = useRoute()
let tabsData = computed(() => generalStore.getLoadedExecutionTabs)
let tabsKey = computed(() => generalStore.tabBarKey)
let showStagingWarning = computed(() => config.isStagingEnvironment)
let isDrawerPinned = computed(() => generalStore.isDrawerPinned)
let showLatestPlanBanner = computed(
  () => generalStore.shouldShowLatestPlanBanner,
)

// Get the currently selected execution ID
const selectedExecutionId = computed(
  () => generalStore.selectedExecution?.executionId,
)

// Enhance tabs data to show star icon for latest plan and ensure correct selection
const enhancedTabsData = computed(() => {
  const featureAvailable = generalStore.isLatestPlanFeatureAvailable
  const latestPlanId = featureAvailable ? generalStore.getLatestPlanId : null
  const showStar =
    featureAvailable &&
    (generalStore.appConfig.parameters?.latestPlanConfig?.showStarInTabBar ??
      true)
  const currentSelectedId = selectedExecutionId.value

  return tabsData.value.map((tab) => ({
    ...tab,
    // Add a star prefix to the text if this is the latest plan (only if feature is available)
    text: showStar && tab.value === latestPlanId ? `⭐ ${tab.text}` : tab.text,
    isLatestPlan: featureAvailable && tab.value === latestPlanId,
    // Ensure selected state is correctly set based on store
    selected: tab.value === currentSelectedId,
  }))
})

// Check if current route is an execution-related view (input data, results, or dashboard)
const isExecutionRelatedView = computed(() => {
  const currentPath = route.path
  return (
    currentPath.startsWith('/input-data') ||
    currentPath.startsWith('/results') ||
    currentPath.startsWith('/dashboard')
  )
})

defineExpose({
  tabsData,
  tabsKey,
  enhancedTabsData,
  isExecutionRelatedView,
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

    // If deselecting and in input-data or results routes, redirect to history-execution
    const currentRoute = router.currentRoute.value.path
    if (
      currentRoute.startsWith('/input-data') ||
      currentRoute.startsWith('/output-data') ||
      currentRoute.startsWith('/results') ||
      currentRoute.startsWith('/dashboard')
    ) {
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
  background: linear-gradient(to right, #fff5f5, #ffe6e6);
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

/* Adjust for latest plan banner */
.main-content.has-banner {
  padding-top: 48px; /* Height of the banner */
}
</style>
