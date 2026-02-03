<template>
  <v-slide-y-transition>
    <div v-if="showBanner" class="latest-plan-banner">
      <div class="banner-content">
        <v-icon class="banner-icon" size="20">mdi-star-outline</v-icon>
        <span class="banner-text">
          {{ t('latestPlan.banner.message') }}
        </span>
        <v-btn
          variant="outlined"
          size="small"
          class="banner-action-btn"
          @click="navigateToHistory"
        >
          {{ t('latestPlan.banner.actionButton') }}
        </v-btn>
        <v-btn
          icon
          variant="text"
          size="x-small"
          class="banner-close-btn"
          @click="dismissBanner"
        >
          <v-icon size="18">mdi-close</v-icon>
        </v-btn>
      </div>
    </div>
  </v-slide-y-transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@/stores/general'

const { t } = useI18n()
const router = useRouter()
const generalStore = useGeneralStore()

// Only show banner if the feature is available AND no latest plan is set
const showBanner = computed(() => 
  generalStore.isLatestPlanFeatureAvailable && generalStore.shouldShowLatestPlanBanner
)

const dismissBanner = () => {
  generalStore.dismissLatestPlanBanner()
}

const navigateToHistory = () => {
  router.push('/history-execution')
}
</script>

<style scoped>
.latest-plan-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 800; /* Below AppDrawer (900) but above main content */
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-variant) 100%);
  color: white;
  padding: 12px 24px;
  padding-left: 80px; /* Leave space for the collapsed drawer */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.banner-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  max-width: 1200px;
  margin: 0 auto;
}

.banner-icon {
  color: var(--accent);
  flex-shrink: 0;
}

.banner-text {
  font-size: 14px;
  font-weight: 500;
}

.banner-action-btn {
  color: white !important;
  border-color: white !important;
  text-transform: none;
  font-weight: 600;
  flex-shrink: 0;
}

.banner-action-btn:hover {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

.banner-close-btn {
  color: white !important;
  opacity: 0.8;
  flex-shrink: 0;
  margin-left: 8px;
}

.banner-close-btn:hover {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.1) !important;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .latest-plan-banner {
    padding: 10px 16px;
  }

  .banner-content {
    flex-wrap: wrap;
    gap: 8px;
  }

  .banner-text {
    font-size: 13px;
    flex: 1 1 100%;
    text-align: center;
    order: 1;
  }

  .banner-icon {
    order: 0;
  }

  .banner-action-btn {
    order: 2;
  }

  .banner-close-btn {
    order: 3;
    position: absolute;
    right: 8px;
    top: 8px;
  }
}
</style>

