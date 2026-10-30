<!--
  CoreHoverCard: a preview that opens beside its trigger after the pointer rests on it, and closes
  when the pointer leaves. Only for extra information: what it shows must also be reachable another
  way (e.g. by selecting the row), since touch and keyboard users do not hover.

  <CoreHoverCard side="right" :width="340">
    <template #trigger><div>Row</div></template>
    Preview of the row
  </CoreHoverCard>
-->
<template>
  <slot v-if="disabled" name="trigger" />
  <HoverCardRoot v-else :open-delay="openDelay" :close-delay="80">
    <HoverCardTrigger as-child>
      <slot name="trigger" />
    </HoverCardTrigger>
    <HoverCardPortal>
      <HoverCardContent
        class="core-hover-card"
        :side="side"
        :align="align"
        :side-offset="12"
        :collision-padding="12"
        :style="{ width: `${width}px` }"
      >
        <slot />
      </HoverCardContent>
    </HoverCardPortal>
  </HoverCardRoot>
</template>

<script setup lang="ts">
import {
  HoverCardContent,
  HoverCardPortal,
  HoverCardRoot,
  HoverCardTrigger,
} from 'reka-ui'

defineOptions({ name: 'CoreHoverCard' })

withDefaults(
  defineProps<{
    side?: 'top' | 'right' | 'bottom' | 'left'
    align?: 'start' | 'center' | 'end'
    /** px */
    width?: number
    /** ms the pointer rests on the trigger before the card opens. */
    openDelay?: number
    /** Keeps the card closed (e.g. for the row that is already shown in full). */
    disabled?: boolean
  }>(),
  {
    side: 'right',
    align: 'start',
    width: 340,
    openDelay: 450,
    disabled: false,
  },
)
</script>

<!--
  Not scoped: Reka renders the content inside a wrapper of its own, which gets the scope
  attribute instead of the element with the class.
-->
<style>
.core-hover-card {
  z-index: var(--z-popover);
  max-width: calc(100vw - 24px);
  max-height: var(--reka-hover-card-content-available-height, 480px);
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-surface));
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-xl);
  font-family: var(--font-sans);
  pointer-events: none;
}
</style>
