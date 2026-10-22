<template>
  <div class="catalog-section">
    <h1 class="catalog-section__title">Buttons and icons</h1>

    <CatalogBlock
      name="CoreButton"
      api="text · icon · variant (filled | outlined | text | icon) · color · size · loading · loadingText · disabled · block"
      column
    >
      <div class="row">
        <CoreButton icon="mdi-open-in-app" text="Load execution" />
        <CoreButton
          variant="outlined"
          icon="mdi-microsoft-excel"
          text="Download Excel"
        />
        <CoreButton
          variant="outlined"
          color="danger"
          icon="mdi-delete-outline"
          text="Delete"
        />
        <CoreButton
          variant="text"
          color="danger"
          icon="mdi-delete-outline"
          text="Delete"
        />
        <CoreButton color="danger" icon="mdi-delete-outline" text="Delete" />
        <CoreButton variant="text" text="Clear filters" />
        <CoreButton variant="text" color="grey" text="Cancel" />
      </div>
      <div class="row">
        <CoreButton
          text="Load execution"
          :loading="true"
          loading-text="Loading…"
        />
        <CoreButton icon="mdi-open-in-app" text="Load execution" disabled />
        <CoreButton
          variant="outlined"
          color="warning"
          icon="mdi-alert"
          text="Review"
        />
        <CoreButton
          variant="outlined"
          color="success"
          icon="mdi-check"
          text="Approve"
        />
      </div>
      <div class="row">
        <CoreButton
          v-for="size in sizes"
          :key="size"
          :size="size"
          :text="size"
          icon="mdi-plus"
        />
      </div>
      <div class="row">
        <CoreButton
          v-for="size in sizes"
          :key="size"
          :size="size"
          variant="icon"
          icon="mdi-pencil"
          :aria-label="`Edit (${size})`"
        />
      </div>
      <div class="row row--narrow">
        <CoreButton block text="Full width" />
      </div>
    </CatalogBlock>

    <CatalogBlock name="CoreIcon" api="name · size · spin · label">
      <CoreIcon v-for="icon in icons" :key="icon" :name="icon" :size="22" />
      <CoreIcon name="mdi-loading" :size="22" spin label="Loading" />
    </CatalogBlock>

    <CatalogBlock name="CoreSpinner" api="size · label">
      <CoreSpinner />
      <CoreSpinner :size="24" class="primary" />
      <CoreSpinner :size="32" label="Loading executions" class="primary" />
    </CatalogBlock>
  </div>
</template>

<script setup lang="ts">
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSpinner from '@cornflow-ui/core/components/core/CoreSpinner.vue'
import CatalogBlock from '../CatalogBlock.vue'

const sizes = ['xs', 'small', 'default', 'large', 'xl'] as const
const icons = [
  'mdi-history',
  'mdi-open-in-app',
  'mdi-microsoft-excel',
  'mdi-star',
  'mdi-calendar-sync',
  'mdi-alert-circle',
]
</script>

<style scoped>
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(var(--spacing) * 2);
}

.row--narrow {
  max-width: 320px;
}

.primary {
  color: var(--color-primary);
}
</style>
