<template>
  <v-menu
    v-model="isOpen"
    :close-on-content-click="false"
    :offset="4"
    location="bottom end"
  >
    <template v-slot:activator="{ props }">
      <slot name="activator" :props="props" :isOpen="isOpen">
        <v-btn
          icon="mdi-dots-vertical"
          variant="text"
          size="small"
          v-bind="props"
          class="core-dropdown-menu__trigger"
        />
      </slot>
    </template>

    <v-card
      class="core-dropdown-menu"
      elevation="2"
      rounded="lg"
      min-width="200"
    >
      <v-list density="compact" class="core-dropdown-menu__list">
        <!-- Render sections with items -->
        <template
          v-for="(section, sectionIndex) in sections"
          :key="sectionIndex"
        >
          <!-- Section header -->
          <v-list-subheader
            v-if="section.title"
            class="core-dropdown-menu__section-header"
          >
            {{ section.title }}
          </v-list-subheader>

          <!-- Section items -->
          <template v-for="(item, itemIndex) in section.items" :key="itemIndex">
            <CoreDropdownMenuItem :item="item" @item-click="handleItemClick" />
          </template>

          <!-- Divider between sections (except last) -->
          <v-divider
            v-if="sectionIndex < sections.length - 1"
            class="core-dropdown-menu__divider"
          />
        </template>

        <!-- Render items without sections -->
        <template
          v-for="(item, itemIndex) in itemsWithoutSections"
          :key="`item-${itemIndex}`"
        >
          <CoreDropdownMenuItem :item="item" @item-click="handleItemClick" />
        </template>

        <!-- Custom content slot -->
        <slot name="content" />
      </v-list>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import CoreDropdownMenuItem from '@/components/core/CoreDropdownMenuItem.vue'

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
  // Items configuration
  items?: DropdownItem[]
  sections?: DropdownSection[]

  // Menu state
  modelValue?: boolean

  // Behavior
  closeOnItemClick?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  sections: () => [],
  modelValue: false,
  closeOnItemClick: true,
})

// Emits
interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'item-click', item: DropdownItem): void
}

const emit = defineEmits<Emits>()

// Local state
const isOpen = ref(false)

// Computed properties
const itemsWithoutSections = computed(() => {
  return props.items || []
})

const sections = computed(() => {
  return props.sections || []
})

// Event handlers
const handleMenuToggle = (value: boolean) => {
  isOpen.value = value
}

const handleItemClick = (item: DropdownItem) => {
  if (item.disabled) return

  // Execute item action if provided
  if (item.action) {
    item.action()
  }

  // Emit item click event
  emit('item-click', item)

  // Close menu if configured to do so
  if (props.closeOnItemClick) {
    isOpen.value = false
  }
}
</script>

<style scoped>
.core-dropdown-menu {
  background: white;
  border-radius: 8px;
  border: 1px solid #6e6e6e33;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.core-dropdown-menu__list {
  padding: 8px 0;
}

.core-dropdown-menu__section-header {
  font-weight: 600;
  font-size: 12px;
  color: var(--title);
  padding: 8px 16px 4px 16px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.core-dropdown-menu__divider {
  margin: 4px 0;
  border-color: #e0e0e0;
}

.core-dropdown-menu__trigger {
  color: var(--subtitle);
}

.core-dropdown-menu__trigger:hover {
  background-color: var(--primary-light-variant);
}
</style>
