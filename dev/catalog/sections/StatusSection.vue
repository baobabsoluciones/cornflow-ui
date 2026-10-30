<template>
  <div class="catalog-section">
    <h1 class="catalog-section__title">Status and feedback</h1>

    <CatalogBlock
      name="CoreBadge"
      api="label · tone · icon · spin · variant (soft | dot) · size (sm | md)"
      column
    >
      <div class="row">
        <CoreBadge v-for="badge in badges" :key="badge.label" v-bind="badge" />
      </div>
      <div class="row">
        <CoreBadge
          tone="warning"
          icon="mdi-star"
          label="Current plan"
          size="sm"
        />
        <CoreBadge
          tone="info"
          icon="mdi-calendar-sync"
          label="Replanning"
          size="sm"
        />
      </div>
      <div class="row">
        <CoreBadge
          v-for="badge in badges"
          :key="badge.label"
          :tone="badge.tone"
          :label="badge.label"
          variant="dot"
        />
      </div>
    </CatalogBlock>

    <CatalogBlock
      name="CoreAlert"
      api="tone (error | warning | info | success) · title · message · icon · actionLabel → action"
      column
    >
      <CoreAlert
        tone="error"
        title="Server message"
        message="Column 'capacity' not found in the products master table (row 14)."
      />
      <CoreAlert
        tone="info"
        message="The 100 latest executions of the range are listed. Narrow the dates to see the rest."
        action-label="Last 7 days"
      />
      <CoreAlert
        tone="warning"
        message="The solver stopped at the time limit."
      />
      <CoreAlert tone="success" message="The data checks passed." />
    </CatalogBlock>

    <CatalogBlock
      name="CoreEmptyState"
      api="title · text · icon · actionLabel → action"
    >
      <CoreEmptyState
        icon="mdi-history"
        title="No executions in these dates"
        text="Executions you create from New execution appear here."
      />
      <CoreEmptyState
        icon="mdi-filter-remove-outline"
        title="No execution matches the filters"
        text="Change the search or widen the dates."
        action-label="Clear filters"
      />
    </CatalogBlock>

    <CatalogBlock
      name="CoreSkeleton"
      api="width · height · shape (line | pill | circle | block)"
      column
    >
      <div class="skeleton-row">
        <CoreSkeleton :width="18" :height="18" shape="circle" />
        <div class="skeleton-lines">
          <CoreSkeleton width="60%" />
          <CoreSkeleton width="85%" :height="10" />
          <CoreSkeleton width="40%" :height="10" />
        </div>
      </div>
      <div class="row">
        <CoreSkeleton :width="110" :height="24" shape="pill" />
        <CoreSkeleton :width="160" :height="36" shape="block" />
      </div>
    </CatalogBlock>

    <CatalogBlock
      name="CoreProgressBar"
      api="value (0–100) · tone · label"
      column
    >
      <CoreProgressBar :value="25" label="25%" class="bar" />
      <CoreProgressBar :value="70" tone="warning" label="70%" class="bar" />
      <CoreProgressBar :value="100" tone="success" label="100%" class="bar" />
    </CatalogBlock>
  </div>
</template>

<script setup lang="ts">
import CoreAlert from '@cornflow-ui/core/components/core/CoreAlert.vue'
import CoreBadge from '@cornflow-ui/core/components/core/CoreBadge.vue'
import CoreEmptyState from '@cornflow-ui/core/components/core/CoreEmptyState.vue'
import CoreProgressBar from '@cornflow-ui/core/components/core/CoreProgressBar.vue'
import CoreSkeleton from '@cornflow-ui/core/components/core/CoreSkeleton.vue'
import type { CoreTone } from '@cornflow-ui/core/types/ui'
import CatalogBlock from '../CatalogBlock.vue'

const badges: {
  label: string
  tone: CoreTone
  icon: string
  spin?: boolean
}[] = [
  { label: 'Success', tone: 'success', icon: 'mdi-check-circle' },
  { label: 'Running', tone: 'primary', icon: 'mdi-loading', spin: true },
  { label: 'Queued', tone: 'neutral', icon: 'mdi-clock-outline' },
  { label: 'Not run', tone: 'warning', icon: 'mdi-minus-circle' },
  { label: 'Error', tone: 'danger', icon: 'mdi-alert-circle' },
  { label: 'Note', tone: 'info', icon: 'mdi-information' },
]
</script>

<style scoped>
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(var(--spacing) * 3);
}

.skeleton-row {
  display: flex;
  gap: calc(var(--spacing) * 2.5);
  max-width: 360px;
}

.skeleton-lines {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 7px;
}

.bar {
  max-width: 240px;
}
</style>
