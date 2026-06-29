<template>
  <div class="main-container" :class="{ 'drawer-pinned': isDrawerPinned }">
    <HelpMenu />
    <WarningsPanel v-if="enableWarnings" />
    <div
      v-if="showAppSectionLoading"
      class="app-section-loading-overlay"
      data-testid="app-section-loading-overlay"
    >
      <div class="app-section-loading-content">
        <v-progress-circular indeterminate color="primary" size="48" width="4" />
        <p class="app-section-loading-text">{{ t('general.loading') }}</p>
      </div>
    </div>
    <router-view v-slot="{ Component }">
      <keep-alive :key="getKey">
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </div>
</template>

<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@/stores/general'
import HelpMenu from '@/components/core/HelpMenu.vue'
import WarningsPanel from '@/components/WarningsPanel.vue'
import appConfig from '@/app/config'
import {
  APP_SECTION_PAGE_READY_KEY,
} from '@/composables/useAppSectionPageReady'

defineOptions({ name: 'CoreAppView' })

const { t } = useI18n()
const route = useRoute()
const generalStore = useGeneralStore()
const getKey = computed(() => generalStore.uploadComponentKey)
const isDrawerPinned = computed(() => generalStore.isDrawerPinned)
const enableWarnings = computed(
  () => appConfig.getCore().parameters.enableWarnings,
)

const showAppSectionLoading = ref(false)

function syncAppSectionLoadingFromRoute() {
  showAppSectionLoading.value = appConfig.isAppSectionShowsLoadingOnEnter(
    route.path,
  )
}

function setAppSectionPageReady() {
  if (!appConfig.isAppSectionShowsLoadingOnEnter(route.path)) return
  showAppSectionLoading.value = false
}

provide(APP_SECTION_PAGE_READY_KEY, setAppSectionPageReady)

watch(
  () => [route.path, route.name] as const,
  () => {
    syncAppSectionLoadingFromRoute()
  },
  { immediate: true },
)
</script>

<style scoped>
.main-container {
  position: relative;
}

.app-section-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-surface), 0.85);
}

.app-section-loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.app-section-loading-text {
  margin: 0;
  font-size: 1rem;
  color: rgb(var(--v-theme-on-surface));
}
</style>
