<!--
  CorePopover: a trigger that opens a floating panel (a menu, a small form…).

  The trigger slot holds one element, normally a button: it gets the click and the ARIA state.
  The default slot gets `close()`.

  <CorePopover v-model:open="open" align="end">
    <template #trigger><button type="button">Add filter</button></template>
    <template #default="{ close }"> … </template>
  </CorePopover>
-->
<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <slot name="trigger" :open="open" />
    </PopoverTrigger>
    <CorePopoverPanel :side="side" :align="align" :width="width">
      <slot :close="close" />
    </CorePopoverPanel>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import CorePopoverPanel from '@cornflow-ui/core/components/core/CorePopoverPanel.vue'

defineOptions({ name: 'CorePopover' })

withDefaults(
  defineProps<{
    side?: 'top' | 'right' | 'bottom' | 'left'
    align?: 'start' | 'center' | 'end'
    width?: number | string
  }>(),
  { side: 'bottom', align: 'start', width: undefined },
)

const open = defineModel<boolean>('open', { default: false })

function close() {
  open.value = false
}
</script>
