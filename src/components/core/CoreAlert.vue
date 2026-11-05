<!--
  CoreAlert: a message inside the page (not a toast): an error the server returned, a warning, a
  note with an action.

  Errors are announced at once (role "alert"); the other tones politely (role "status").

  <CoreAlert tone="danger" title="Server message" message="Column 'capacity' not found." />
  <CoreAlert tone="info" message="Only the 100 latest executions are listed." action-label="Last 7 days" @action="narrow" />
-->
<template>
  <div
    :class="['core-alert', `core-tone--${tone}`]"
    :role="tone === 'danger' ? 'alert' : 'status'"
  >
    <CoreIcon
      :name="icon || DEFAULT_ICONS[tone]"
      :size="18"
      class="core-alert__icon"
    />
    <div class="core-alert__body">
      <span v-if="title" class="core-alert__title">{{ title }}</span>
      <span class="core-alert__message"
        ><slot>{{ message }}</slot></span
      >
    </div>
    <button
      v-if="actionLabel"
      type="button"
      class="core-alert__action"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'

defineOptions({ name: 'CoreAlert' })

type AlertTone = 'danger' | 'warning' | 'info' | 'success'

withDefaults(
  defineProps<{
    tone?: AlertTone
    title?: string
    message?: string
    /** Replaces the tone's icon. */
    icon?: string
    actionLabel?: string
  }>(),
  { tone: 'info', title: '', message: '', icon: '', actionLabel: '' },
)

const emit = defineEmits<{ action: [] }>()

const DEFAULT_ICONS: Record<AlertTone, string> = {
  danger: 'mdi-alert-circle',
  warning: 'mdi-alert',
  info: 'mdi-information',
  success: 'mdi-check-circle',
}
</script>

<style scoped>
.core-alert {
  display: flex;
  align-items: flex-start;
  gap: calc(var(--spacing) * 2.5);
  box-sizing: border-box;
  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 3);
  border: 1px solid var(--tone-border);
  border-radius: var(--radius-md);
  background: var(--tone-soft);
  font-family: var(--font-sans);
  font-size: var(--text-md);
  line-height: 18px;
}

.core-alert__icon {
  color: var(--tone);
}

.core-alert__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.core-alert__title {
  font-weight: var(--font-weight-bold);
  color: var(--tone-strong);
}

.core-alert__message {
  color: var(--color-text);
  overflow-wrap: anywhere;
  text-wrap: pretty;
}

.core-alert__action {
  flex: none;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: var(--font-weight-medium);
  color: var(--tone-strong);
  white-space: nowrap;
  cursor: pointer;
}

.core-alert__action:hover {
  text-decoration: underline;
}

.core-alert__action:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
</style>
