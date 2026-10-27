<!--
  DrawerExecutionList: the panel of the side menu's execution selector. The DAG's latest
  executions with a dot in the colour of their state, and "See full history".

  <DrawerExecutionList :loaded="loaded" :latest="latest" :loading="loadingRecent"
    @open="open" @history="goToHistory" />
-->
<template>
  <div class="drawer-executions" data-testid="drawer-executions">
    <span class="drawer-executions__label">{{ $t('drawer.latestExecutions') }}</span>
    <div v-if="loading && latest.length === 0" class="drawer-executions__state">
      <CoreSpinner :size="16" />
    </div>
    <p v-else-if="latest.length === 0" class="drawer-executions__state">
      {{ $t('drawer.noExecutions') }}
    </p>
    <ul v-else class="drawer-executions__list">
      <li v-for="execution in latest" :key="execution.id">
        <button
          type="button"
          class="drawer-executions__item"
          :class="{ 'is-loaded': execution.id === loaded?.id }"
          :aria-current="execution.id === loaded?.id ? 'true' : undefined"
          :disabled="opening !== null"
          @click="$emit('open', execution)"
        >
          <span class="drawer-executions__check">
            <CoreSpinner v-if="opening === execution.id" :size="14" />
            <CoreIcon v-else-if="execution.id === loaded?.id" name="mdi-check" :size="16" />
          </span>
          <span class="drawer-executions__text">
            <span class="drawer-executions__name">{{ execution.name }}</span>
            <span class="drawer-executions__date">{{ execution.date }}</span>
          </span>
          <span
            class="drawer-executions__dot"
            :class="`is-${execution.status.tone}`"
            :title="execution.status.label"
          />
        </button>
      </li>
    </ul>

    <button type="button" class="drawer-executions__history" @click="$emit('history')">
      <span>{{ $t('drawer.seeHistory') }}</span>
      <CoreIcon name="mdi-arrow-right" :size="16" />
    </button>
  </div>
</template>

<script setup lang="ts">
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSpinner from '@cornflow-ui/core/components/core/CoreSpinner.vue'
import type { DrawerExecution } from '@cornflow-ui/core/composables/navigation/useDrawerExecutions'

defineOptions({ name: 'DrawerExecutionList' })

withDefaults(
  defineProps<{
    loaded: DrawerExecution | null
    latest: DrawerExecution[]
    loading?: boolean
    /** Id of the execution being loaded. */
    opening?: string | null
  }>(),
  { loading: false, opening: null },
)

defineEmits<{ open: [execution: DrawerExecution]; history: [] }>()
</script>

<style scoped>
.drawer-executions {
  display: flex;
  flex-direction: column;
  padding: calc(var(--spacing) * 1.5) 0;
  font-family: var(--font-sans);
  color: var(--color-text);
}

.drawer-executions__label {
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 3);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.drawer-executions__state {
  margin: 0;
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 3);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.drawer-executions__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.drawer-executions__item {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  width: 100%;
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 3);
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.drawer-executions__item:hover:not(:disabled) {
  background: var(--color-surface-hover);
}

.drawer-executions__item:disabled {
  cursor: default;
}

.drawer-executions__item.is-loaded {
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}

.drawer-executions__check {
  flex: none;
  display: flex;
  justify-content: center;
  width: 16px;
}

.drawer-executions__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.drawer-executions__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-sm);
}

.drawer-executions__item.is-loaded .drawer-executions__name {
  font-weight: var(--font-weight-medium);
}

.drawer-executions__date {
  flex: none;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.drawer-executions__dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-neutral);
}

.drawer-executions__dot.is-success {
  background: var(--color-success);
}

.drawer-executions__dot.is-warning {
  background: var(--color-warning);
}

.drawer-executions__dot.is-danger {
  background: var(--color-danger);
}

.drawer-executions__dot.is-primary {
  background: var(--color-primary);
}

.drawer-executions__dot.is-info {
  background: var(--color-info);
}

.drawer-executions__history {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  margin-top: calc(var(--spacing) * 1.5);
  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 3) calc(var(--spacing) * 1);
  border: 0;
  border-top: 1px solid var(--color-divider);
  background: none;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
  text-align: left;
  cursor: pointer;
}

.drawer-executions__history span {
  flex: 1;
}
</style>
