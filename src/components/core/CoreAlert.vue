<!--
  CoreAlert: a message inside the page (not a toast): an error the server returned, a warning, a
  note with an action.

  Errors are announced at once (role "alert"); the other tones politely (role "status").

  <CoreAlert tone="error" title="Server message" message="Column 'capacity' not found." />
  <CoreAlert tone="info" message="Only the 100 latest executions are listed." action-label="Last 7 days" @action="narrow" />
-->
<template>
  <div
    :class="['core-alert', `core-alert--${tone}`]"
    :role="tone === 'error' ? 'alert' : 'status'"
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

type AlertTone = 'error' | 'warning' | 'info' | 'success'

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
  error: 'mdi-alert-circle',
  warning: 'mdi-alert',
  info: 'mdi-information',
  success: 'mdi-check-circle',
}
</script>

<style scoped>
.core-alert {
  --alert-base: var(--color-info);
  --alert-soft: var(--color-info-soft);
  --alert-border: var(--color-info-border);
  --alert-strong: var(--color-info-strong);

  display: flex;
  align-items: flex-start;
  gap: calc(var(--spacing) * 2.5);
  box-sizing: border-box;
  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 3);
  border: 1px solid var(--alert-border);
  border-radius: var(--radius-md);
  background: var(--alert-soft);
  font-family: var(--font-sans);
  font-size: var(--text-md);
  line-height: 18px;
}

.core-alert--error {
  --alert-base: var(--color-danger);
  --alert-soft: var(--color-danger-soft);
  --alert-border: var(--color-danger-border);
  --alert-strong: var(--color-danger-strong);
}

.core-alert--warning {
  --alert-base: var(--color-warning);
  --alert-soft: var(--color-warning-soft);
  --alert-border: var(--color-warning-border);
  --alert-strong: var(--color-warning-strong);
}

.core-alert--success {
  --alert-base: var(--color-success);
  --alert-soft: var(--color-success-soft);
  --alert-border: var(--color-success-border);
  --alert-strong: var(--color-success-strong);
}

.core-alert__icon {
  color: var(--alert-base);
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
  color: var(--alert-strong);
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
  color: var(--alert-strong);
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
