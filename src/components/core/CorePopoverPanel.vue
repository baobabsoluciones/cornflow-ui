<!--
  CorePopoverPanel: the floating card of a popover (white, rounded, with shadow), placed next to
  its trigger or anchor and kept inside the window. Focus moves into it when it opens and back
  when it closes; Escape and a click outside close it.

  It goes inside a Reka `PopoverRoot`. CorePopover puts the root, the trigger and this panel
  together; use the panel on its own when the trigger is not the whole anchor (as in a filter chip
  with a remove button).
-->
<template>
  <PopoverPortal>
    <PopoverContent
      class="core-popover-panel"
      :side="side"
      :align="align"
      :side-offset="6"
      :collision-padding="8"
      :style="
        width
          ? { width: typeof width === 'number' ? `${width}px` : width }
          : undefined
      "
    >
      <slot />
    </PopoverContent>
  </PopoverPortal>
</template>

<script setup lang="ts">
import { PopoverContent, PopoverPortal } from 'reka-ui'

defineOptions({ name: 'CorePopoverPanel' })

withDefaults(
  defineProps<{
    side?: 'top' | 'right' | 'bottom' | 'left'
    align?: 'start' | 'center' | 'end'
    /** px, or any CSS length. Without it the panel fits its content. */
    width?: number | string
  }>(),
  { side: 'bottom', align: 'start', width: undefined },
)
</script>

<style scoped>
.core-popover-panel {
  z-index: var(--z-popover);
  box-sizing: border-box;
  max-width: calc(100vw - 16px);
  max-height: min(420px, var(--reka-popover-content-available-height, 420px));
  display: flex;
  flex-direction: column;
  padding: calc(var(--spacing) * 1.5);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
  font-family: var(--font-sans);
  color: var(--color-text);
  outline: none;
}
</style>
