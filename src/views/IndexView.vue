<template>
  <v-app>
    <core-app-drawer style="position: fixed !important" />
    <core-app-view />
    <MAppBarTab
      :key="tabsKey"
      :tabs="tabsData"
      createTitle="Create"
      @close="removeTab"
      @create="createTab"
      @select="selectTab"
    >
    </MAppBarTab>
  </v-app>
</template>

<script setup>
import { useGeneralStore } from '@/stores/general'
import AuthService from '@/services/AuthService'
import CoreAppHeader from '@/components/AppHeader.vue'
import CoreAppDrawer from '@/components/AppDrawer.vue'
import CoreAppView from '@/components/AppView.vue'
import { useRouter } from 'vue-router'
import { ref, computed, defineExpose, Suspense } from 'vue'

const generalStore = useGeneralStore()
const router = useRouter()
let tabsData = computed(() => generalStore.getLoadedExecutionTabs)
let tabsKey = ref(0)

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
    tabsKey.value++
  } else {
    generalStore.setSelectedExecution(executionTab.value)
    // Check if the current route matches 'project-execution' or 'history-execution'
    if (
      currentRoute === '/project-execution' ||
      currentRoute === '/history-execution'
    ) {
      router.push('/dashboard') // Go to the dashboard
    } else {
      generalStore.incrementUploadComponentKey()
    }
    // Set all tabs to not selected, except for the current one
    generalStore.getLoadedExecutionTabs.forEach((tab) => {
      tab.selected = tab.value === executionTab.value
    })
    tabsKey.value++
  }
}

// Check if user is logged in
if (AuthService.isAuthenticated()) {
  // Launch INITIALIZE_DATA action
  generalStore.initializeData()
}
</script>

<style></style>
