<!--
  AddFilterMenu: the "Add filter" chip. It opens the fields that can still be filtered, by group,
  with a search box; picking one emits `add` with its key.
-->
<template>
  <CorePopover v-model:open="open" :width="280">
    <template #trigger>
      <button
        type="button"
        class="add-filter"
        :class="{ 'is-open': open }"
        v-bind="$attrs"
      >
        <CoreIcon name="mdi-plus" :size="16" />
        <span>{{ label }}</span>
      </button>
    </template>
    <CoreMenu
      v-model:query="query"
      :title="label"
      :items="menuItems"
      searchable
      :search-placeholder="searchPlaceholder"
      :empty-text="noMatchesText"
      @select="add($event.key)"
    />
  </CorePopover>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreMenu from '@cornflow-ui/core/components/core/CoreMenu.vue'
import type { CoreMenuItem } from '@cornflow-ui/core/components/core/CoreMenu.vue'
import CorePopover from '@cornflow-ui/core/components/core/CorePopover.vue'

defineOptions({ name: 'CoreAddFilterMenu', inheritAttrs: false })

export interface AddFilterField {
  key: string
  title: string
  icon: string
}

export interface AddFilterGroup {
  key: string
  title: string
  fields: AddFilterField[]
}

const props = defineProps<{
  label: string
  searchPlaceholder: string
  noMatchesText: string
  /** Filters that can be added, grouped; empty groups are not shown. */
  groups: AddFilterGroup[]
}>()

const emit = defineEmits<{ add: [key: string] }>()

const open = ref(false)
const query = ref('')

watch(open, (isOpen) => {
  if (!isOpen) query.value = ''
})

const visibleGroups = computed(() => {
  const text = query.value.trim().toLowerCase()
  return props.groups
    .map((group) => ({
      ...group,
      fields: group.fields.filter(
        (field) => !text || field.title.toLowerCase().includes(text),
      ),
    }))
    .filter((group) => group.fields.length > 0)
})

const menuItems = computed<CoreMenuItem[]>(() =>
  visibleGroups.value.flatMap((group) => [
    { key: `group:${group.key}`, label: group.title, header: true },
    ...group.fields.map((field) => ({
      key: field.key,
      label: field.title,
      icon: field.icon,
      testId: `add-filter-${field.key}`,
    })),
  ]),
)

function add(key: string) {
  emit('add', key)
  open.value = false
}
</script>

<style scoped>
.add-filter {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  height: 32px;
  box-sizing: border-box;
  padding: 0 calc(var(--spacing) * 3) 0 calc(var(--spacing) * 2.5);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-family: var(--font-sans);
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--duration-base) var(--ease-standard);
}

.add-filter:hover,
.add-filter.is-open {
  background: var(--color-primary-subtle);
}

.add-filter:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
