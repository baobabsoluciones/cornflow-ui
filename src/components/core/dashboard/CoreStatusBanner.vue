<!--
  CoreStatusBanner: the verdict of a dashboard in one line ("Feasible plan · 3 products short"),
  in the tone of the verdict, with the figures that back it on the right.

  - `tone`: `success`, `warning`, `danger` or `info`; it colours the icon, the edge and a soft wash
    behind the verdict.
  - `stats`: the figures, as CoreStat takes them; give a tone only to the ones that need attention.

  <CoreStatusBanner title="Feasible plan · 3 products short" tone="warning" icon="mdi-alert"
    :stats="[{ value: '1,240', label: 'Units short', tone: 'danger' }, { value: '12', label: 'Extra shifts' }]" />
-->
<template>
  <section class="core-status-banner" :class="`core-tone--${tone}`" role="status">
    <div class="core-status-banner__verdict">
      <span class="core-status-banner__icon">
        <CoreIcon :name="icon || DEFAULT_ICONS[tone]" :size="22" />
      </span>
      <p class="core-status-banner__title">{{ title }}</p>
    </div>
    <dl v-if="stats.length" class="core-status-banner__stats">
      <CoreStat
        v-for="stat in stats"
        :key="stat.label"
        v-bind="stat"
        size="large"
        class="core-status-banner__stat"
      />
    </dl>
  </section>
</template>

<script setup lang="ts">
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreStat, { type CoreStatItem } from '@cornflow-ui/core/components/core/CoreStat.vue'

defineOptions({ name: 'CoreStatusBanner' })

type BannerTone = 'success' | 'warning' | 'danger' | 'info'

const DEFAULT_ICONS: Record<BannerTone, string> = {
  success: 'mdi-check-circle',
  warning: 'mdi-alert',
  danger: 'mdi-alert-octagon',
  info: 'mdi-information',
}

withDefaults(
  defineProps<{
    title: string
    tone?: BannerTone
    icon?: string
    stats?: CoreStatItem[]
  }>(),
  { tone: 'info', icon: '', stats: () => [] },
)
</script>

<style scoped>
.core-status-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--spacing) * 5) calc(var(--spacing) * 8);
  padding: calc(var(--spacing) * 5) calc(var(--spacing) * 6);
  border: 1px solid var(--tone-border);
  border-radius: var(--radius-xl);
  background: linear-gradient(100deg, var(--tone-soft) 0%, var(--color-surface) 55%);
  box-shadow: var(--shadow-sm);
  font-family: var(--font-sans);
  color: var(--color-text);
}

.core-status-banner__verdict {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 4);
  min-width: 0;
}

.core-status-banner__icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: inset 0 0 0 1px var(--tone-border);
  color: var(--tone);
}

.core-status-banner__title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-weight-medium);
  line-height: var(--leading-tight);
}

.core-status-banner__stats {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
}

.core-status-banner__stat {
  padding: 0 calc(var(--spacing) * 6);
}

.core-status-banner__stat + .core-status-banner__stat {
  border-left: 1px solid var(--color-divider);
}

.core-status-banner__stat:last-child {
  padding-right: 0;
}
</style>
