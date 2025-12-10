<template>
  <div class="main-container" :class="{ 'drawer-pinned': isDrawerPinned }">
    <HelpMenu />
    <router-view v-slot="{ Component }">
      <keep-alive :key="getKey">
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useGeneralStore } from '@/stores/general'
import HelpMenu from '@/components/core/HelpMenu.vue'

export default defineComponent({
  name: 'CoreAppView',
  components: { HelpMenu },
  data: () => ({
    store: useGeneralStore(),
  }),
  computed: {
    getKey() {
      return this.store.uploadComponentKey
    },
    isDrawerPinned() {
      return this.store.isDrawerPinned
    },
  },
})
</script>

<style>
/* Styles are now handled in main.css */
</style>
