<template>
  <div class="core-title-view">
    <div class="core-title-view__header">
      <div class="core-title-view__left">
        <div class="core-title-view__icon-title-row">
          <CoreIcon :name="icon" :size="22" class="core-title-view__icon" />
          <h4 class="core-title-view__title">{{ title }}</h4>
        </div>
        <div class="core-title-view__description">
          <p v-if="description">{{ description }}</p>
        </div>
      </div>
      <div v-if="hasDropdownActions || $slots.actions" class="core-title-view__actions">
        <slot name="actions" />
        <CoreDropdownMenu
          v-if="hasDropdownActions"
          :items="dropdownItems"
          :sections="dropdownSections"
          @item-click="handleDropdownItemClick"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CoreDropdownMenu from './CoreDropdownMenu.vue'
import CoreIcon from './CoreIcon.vue'

// Types
interface DropdownItem {
  id?: string
  title: string
  icon?: string
  rightIcon?: string
  rightContent?: string
  disabled?: boolean
  action?: () => void
  data?: any
}

interface DropdownSection {
  title?: string
  items: DropdownItem[]
}

// Props
interface Props {
  icon: string
  title: string
  description?: string
  dropdownItems?: DropdownItem[]
  dropdownSections?: DropdownSection[]
}

const props = withDefaults(defineProps<Props>(), {
  description: '',
  dropdownItems: () => [],
  dropdownSections: () => [],
})

// Emits
type Emits = (e: 'dropdown-item-click', item: DropdownItem) => void

const emit = defineEmits<Emits>()

// Computed
const hasDropdownActions = computed(() => {
  return (
    (props.dropdownItems && props.dropdownItems.length > 0) ||
    (props.dropdownSections && props.dropdownSections.length > 0)
  )
})

// Event handlers
const handleDropdownItemClick = (item: DropdownItem) => {
  emit('dropdown-item-click', item)
}
</script>

<style src="./CoreTitleView.css" scoped></style>
