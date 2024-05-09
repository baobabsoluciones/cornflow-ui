<template>
  <div class="main-container">
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

export default defineComponent({
  name: 'CoreAppView',
  components: {},
  data: () => ({
    store: useGeneralStore(),
  }),
  computed: {
    getKey() {
      return this.store.uploadComponentKey
    },
  },
})
</script>

<style></style>
