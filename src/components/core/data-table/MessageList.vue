<!--
  MessageList: a check that only returns sentences ("Product P-199 has no demand"), one per row
  with the icon of its level and its number. The host filters `messages` (search); with none it
  says so.

  <MessageList :messages="['Line L22 has no shifts in week 45.']" level="warning" />
-->
<template>
  <ol v-if="messages.length > 0" class="message-list" :aria-label="ariaLabel || undefined">
    <li
      v-for="(message, index) in messages"
      :key="index"
      class="message-list__item"
      data-testid="message-list-item"
    >
      <CoreIcon
        :name="level === 'error' ? 'mdi-alert-circle' : 'mdi-alert'"
        :size="18"
        :label="level === 'error' ? $t('dataTable.messages.error') : $t('dataTable.messages.warning')"
        class="message-list__icon"
        :class="`is-${level}`"
      />
      <span class="message-list__text">{{ message }}</span>
      <span class="message-list__number">#{{ index + 1 }}</span>
    </li>
  </ol>
  <CoreEmptyState v-else icon="mdi-check-circle-outline" :title="emptyTitle || $t('dataTable.messages.none')" />
</template>

<script setup lang="ts">
import CoreEmptyState from '@cornflow-ui/core/components/core/CoreEmptyState.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'

defineOptions({ name: 'MessageList' })

withDefaults(
  defineProps<{
    messages: string[]
    level: 'error' | 'warning'
    /** What to say when there are no messages (no match for the search, say). */
    emptyTitle?: string
    ariaLabel?: string
  }>(),
  { emptyTitle: '', ariaLabel: '' },
)
</script>

<style scoped>
.message-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  font-family: var(--font-sans);
}

.message-list__item {
  display: flex;
  align-items: flex-start;
  gap: calc(var(--spacing) * 3);
  padding: calc(var(--spacing) * 3.5) calc(var(--spacing) * 4);
  border-bottom: 1px solid var(--color-border-subtle);
}

.message-list__icon {
  flex: none;
  margin-top: 1px;
}

.message-list__icon.is-error {
  color: var(--color-danger);
}

.message-list__icon.is-warning {
  color: var(--color-warning);
}

.message-list__text {
  flex: 1;
  min-width: 0;
  font-size: var(--text-md);
  line-height: 1.45;
  color: var(--color-text);
  overflow-wrap: anywhere;
}

.message-list__number {
  flex: none;
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-subtle);
}
</style>
