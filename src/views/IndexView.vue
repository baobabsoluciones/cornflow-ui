<template>
  <v-app>
    <core-app-drawer class="app-drawer" />
    <core-app-view />
    <div class="tab-container">
      <MAppBarTab
        :key="tabsKey"
        :tabs="tabsData"
        :createTitle="$t('projectExecution.create')"
        @close="removeTab"
        @create="createTab"
        @select="selectTab"
      >
        <template #actions>
          <div class="d-flex align-center" style="min-width: 200px !important">
            <v-img height="20" src="@/app/assets/logo/baobab_logo.png" />
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
  </v-app>
</template>

<script setup>
import { useGeneralStore } from '@/stores/general'
import AuthService from '@/services/AuthService'
import CoreAppDrawer from '@/components/AppDrawer.vue'
import CoreAppView from '@/components/AppView.vue'
import { useRouter } from 'vue-router'
import { computed, defineExpose } from 'vue'

const generalStore = useGeneralStore()
const router = useRouter()
let tabsData = computed(() => generalStore.getLoadedExecutionTabs)
let tabsKey = computed(() => generalStore.tabBarKey)

defineExpose({
  tabsData,
  tabsKey,
})
const removeTab = (index) => {
  generalStore.removeLoadedExecution(index)
}

const createTab = () => {
  router.push({ path: 'project-execution' })
  generalStore.incrementUploadComponentKey()
}

const selectTab = (executionTab) => {
  const currentRoute = router.currentRoute.value.path

  if (generalStore.selectedExecution?.executionId === executionTab.value) {
    generalStore.setSelectedExecution(null)
    // Check if the current route matches 'project-execution' or 'history-execution'
    if (
      currentRoute === '/project-execution' ||
      currentRoute === '/history-execution'
    ) {
      router.go(-1) // Go to the previous route
    } else {
      router.push('/history-execution') // Go to the history execution
    }
    // Set all tabs to not selected
    generalStore.getLoadedExecutionTabs.forEach((tab) => {
      tab.selected = false
    })
    generalStore.incrementTabBarKey()
  } else {
    generalStore.setSelectedExecution(executionTab.value)
    // Check if the current route matches 'project-execution' or 'history-execution'
    if (
      currentRoute === '/project-execution' ||
      currentRoute === '/history-execution'
    ) {
      router.push('/input-data') // Go to the input data
    } else {
      generalStore.incrementUploadComponentKey()
    }
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

.tab-container {
  width: 100%;
  display: flex;
  flex-direction: column;
}
</style>
