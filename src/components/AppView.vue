<template>
  <div class="main-container">
    <v-btn
      fab
      icon
      rounded
      density="compact"
      class="mt-4"
      style="position: fixed; right: 0"
      @click="settingsDrawer = !settingsDrawer"
    >
      <v-icon>mdi-cog</v-icon>
    </v-btn>
    <SettingsDrawer v-model="settingsDrawer" @close="settingsDrawer = false" />
    <router-view v-slot="{ Component }">
      <keep-alive :key="getKey">
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import SettingsDrawer from '@/components/SettingsDrawer.vue'

export default defineComponent({
  name: 'CoreAppView',
  components: { SettingsDrawer },
  data: () => ({
    settingsDrawer: false,
  }),
  computed: {
    getKey() {
      const key = this.$route.query.key
      return Array.isArray(key) ? key[0] : key || 'default'
    },
  },
})
</script>

<style></style>
