<template>
  <v-app>
    <core-app-drawer style="position: fixed !important" />
    <core-app-view />
    <app-bar-tab
      :tabs="generalStore.getLoadedExecutionTabs"
      createTitle="Create"
      @close="removeTab"
      @create="createTab"
      @select="selectTab"
    >
    </app-bar-tab>
  </v-app>
</template>

<script setup>
import { useGeneralStore } from '@/stores/general'
import AuthService from '@/services/AuthService'
import CoreAppHeader from '@/components/AppHeader.vue'
import CoreAppDrawer from '@/components/AppDrawer.vue'
import CoreAppView from '@/components/AppView.vue'
import AppBarTab from '@/components/core/AppBarTab.vue'
import { useRouter } from 'vue-router'

const generalStore = useGeneralStore()
const router = useRouter()

const removeTab = (index) => {
  generalStore.removeLoadedExecution(index)
}

const createTab = () => {
  router.push('/project-execution')
}

const selectTab = (executionTab) => {
  generalStore.setSelectedExecution(executionTab.value)
}

// Check if user is logged in
if (AuthService.isAuthenticated()) {
  // Launch INITIALIZE_DATA action
  generalStore.initializeData()
}
</script>

<style></style>
