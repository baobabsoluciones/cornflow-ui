<!--
  CoreDropdownMenu: a "⋮" button that opens a list of actions (CoreMenu), loose or in sections.
  An item runs its `action` and is emitted with `item-click`; the menu closes after it unless
  `closeOnItemClick` is false.

  <CoreDropdownMenu :sections="[{ title: 'Data', items: [{ title: 'Download', icon: 'mdi-download', action }] }]" />
-->
<template>
  <CorePopover v-model:open="open" align="end" :width="240">
    <template #trigger>
      <slot name="activator" :is-open="open">
        <button
          type="button"
          class="core-dropdown-menu__trigger"
          :aria-label="label"
          :title="label"
          data-testid="core-dropdown-menu-trigger"
        >
          <CoreIcon name="mdi-dots-vertical" :size="20" />
        </button>
      </slot>
    </template>
    <CoreMenu :items="menuItems" @select="pick" />
    <slot name="content" />
  </CorePopover>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreMenu, { type CoreMenuItem } from '@cornflow-ui/core/components/core/CoreMenu.vue'
import CorePopover from '@cornflow-ui/core/components/core/CorePopover.vue'

defineOptions({ name: 'CoreDropdownMenu' })

export interface DropdownItem {
  id?: string
  title: string
  icon?: string
  disabled?: boolean
  action?: () => void
  data?: any
}

export interface DropdownSection {
  title?: string
  items: DropdownItem[]
}

const props = withDefaults(
  defineProps<{
    items?: DropdownItem[]
    sections?: DropdownSection[]
    closeOnItemClick?: boolean
  }>(),
  { items: () => [], sections: () => [], closeOnItemClick: true },
)

const emit = defineEmits<{ 'item-click': [item: DropdownItem] }>()

const open = defineModel<boolean>({ default: false })

const { t } = useI18n()
const label = computed(() => t('general.moreActions'))

/** Every item with the key CoreMenu gives back, in the order shown. */
const entries = computed(() => {
  const list: { key: string; item: DropdownItem }[] = []
  props.sections.forEach((section, s) =>
    section.items.forEach((item, i) => list.push({ key: `s${s}-${i}`, item })),
  )
  props.items.forEach((item, i) => list.push({ key: `i${i}`, item }))
  return list
})

const menuItems = computed<CoreMenuItem[]>(() => {
  const rows: CoreMenuItem[] = []
  const row = (key: string, item: DropdownItem): CoreMenuItem => ({
    key,
    label: item.title,
    icon: item.icon,
    disabled: item.disabled,
    testId: item.id ? `dropdown-item-${item.id}` : undefined,
  })
  props.sections.forEach((section, s) => {
    if (s > 0) rows.push({ key: `sep-${s}`, label: '', separator: true })
    if (section.title) rows.push({ key: `head-${s}`, label: section.title, header: true })
    section.items.forEach((item, i) => rows.push(row(`s${s}-${i}`, item)))
  })
  if (props.sections.length && props.items.length) {
    rows.push({ key: 'sep-items', label: '', separator: true })
  }
  props.items.forEach((item, i) => rows.push(row(`i${i}`, item)))
  return rows
})

function pick(row: CoreMenuItem) {
  const item = entries.value.find((entry) => entry.key === row.key)?.item
  if (!item || item.disabled) return
  item.action?.()
  emit('item-click', item)
  if (props.closeOnItemClick) open.value = false
}
</script>

<style scoped>
.core-dropdown-menu__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard);
}

.core-dropdown-menu__trigger:hover,
.core-dropdown-menu__trigger[data-state='open'] {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.core-dropdown-menu__trigger:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
