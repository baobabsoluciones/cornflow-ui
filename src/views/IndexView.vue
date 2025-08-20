<template>
  <v-app>
    <div class="marquee-container" v-if="showStagingWarning">
      <Vue3Marquee :pause-on-hover="true">
          🚧 {{ $t('projectExecution.stagingWarning') }} 🚧
      </Vue3Marquee>
    </div>
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
import { computed } from 'vue'
import {Vue3Marquee} from 'vue3-marquee'
import config from '@/config'

const generalStore = useGeneralStore()
const router = useRouter()
let tabsData = computed(() => generalStore.getLoadedExecutionTabs)
let tabsKey = computed(() => generalStore.tabBarKey)
let showStagingWarning = computed(() => config.isStagingEnvironment)

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
      router.push('/output-data') // Go to the output data
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

.marquee-container {
  width: 100%;
  display: flex;
  flex-direction: column;  
  height:40px;
  background: linear-gradient(to right, #fff5f5, #ffe6e6);
  padding: 5px;
  color: #000;
  border-bottom: 2px solid #ffcccc;
  font-weight: bold;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
