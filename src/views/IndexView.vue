<template>
  <v-app>
    <core-app-drawer />
    <core-app-header />
    <core-app-view />
  </v-app>
</template>

<script setup>
import { useGeneralStore } from '@/stores/general'
import AuthService from "@/services/AuthService";
import CoreAppHeader from '@/components/AppHeader.vue'
import CoreAppDrawer from '@/components/AppDrawer.vue'
import CoreAppView from '@/components/AppView.vue'

const generalStore = useGeneralStore();

// Check if user is logged in
if (AuthService.isAuthenticated()) {
  // Launch INITIALIZE_DATA action
  generalStore.initializeData();
};

</script>

<style></style>