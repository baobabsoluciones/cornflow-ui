<!--
  CoreDialog: a modal dialog. It keeps the focus inside while open, returns it to where it was on
  close, and closes with Escape or a click on the backdrop unless it is `persistent`.

  <CoreDialog v-model="open" title="Delete this execution?" icon="mdi-delete-outline" tone="danger">
    It will be removed from the history.
    <template #actions>
      <CoreButton text="Cancel" variant="outlined" @click="open = false" />
      <CoreButton text="Delete" color="danger" @click="remove" />
    </template>
  </CoreDialog>
-->
<template>
  <DialogRoot :open="modelValue" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay class="core-dialog__overlay" />
      <DialogContent
        v-bind="$attrs"
        class="core-dialog"
        :style="{ width: `${width}px` }"
        @escape-key-down="persistent && $event.preventDefault()"
        @pointer-down-outside="persistent && $event.preventDefault()"
        @interact-outside="persistent && $event.preventDefault()"
      >
        <div class="core-dialog__header">
          <CoreIcon
            v-if="icon"
            :name="icon"
            :size="22"
            :class="['core-dialog__icon', `is-${tone}`]"
          />
          <DialogTitle class="core-dialog__title">{{ title }}</DialogTitle>
          <DialogClose v-if="closable" as-child>
            <button
              type="button"
              class="core-dialog__close"
              :aria-label="$t('common.close')"
            >
              <CoreIcon name="mdi-close" :size="18" />
            </button>
          </DialogClose>
        </div>
        <DialogDescription as="div" class="core-dialog__body">
          <slot />
        </DialogDescription>
        <div v-if="$slots.actions" class="core-dialog__actions">
          <slot name="actions" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'

defineOptions({ name: 'CoreDialog', inheritAttrs: false })

withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    icon?: string
    /** Colour of the icon: `danger` for destructive actions. */
    tone?: 'primary' | 'danger'
    /** px */
    width?: number
    /** Escape and a click outside do not close it (e.g. while an action runs). */
    persistent?: boolean
    /** Shows a close button in the header. */
    closable?: boolean
  }>(),
  { icon: '', tone: 'primary', width: 420, persistent: false, closable: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function onOpenChange(open: boolean) {
  emit('update:modelValue', open)
}
</script>

<style scoped>
.core-dialog__overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-dialog);
  background: var(--color-scrim);
}

.core-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: var(--z-dialog);
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3);
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  box-sizing: border-box;
  padding: calc(var(--spacing) * 6);
  overflow: auto;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-xl);
  font-family: var(--font-sans);
  color: var(--color-text);
  transform: translate(-50%, -50%);
  outline: none;
}

.core-dialog__header {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2.5);
}

.core-dialog__icon.is-primary {
  color: var(--color-primary);
}

.core-dialog__icon.is-danger {
  color: var(--color-danger-strong);
}

.core-dialog__title {
  flex: 1;
  margin: 0;
  font-size: 1.125rem;
  font-weight: var(--font-weight-medium);
  line-height: var(--leading-tight);
  color: var(--color-primary);
}

.core-dialog__close {
  display: inline-flex;
  padding: calc(var(--spacing) * 1);
  border: 0;
  border-radius: var(--radius-md);
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
}

.core-dialog__close:hover {
  background: var(--color-surface-hover);
}

.core-dialog__body {
  font-size: var(--text-md);
  line-height: var(--leading-normal);
  color: var(--color-text-muted);
  text-wrap: pretty;
}

.core-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: calc(var(--spacing) * 2);
  margin-top: calc(var(--spacing) * 2);
}
</style>
