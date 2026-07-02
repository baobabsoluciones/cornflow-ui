<template>
  <v-list-item
    :disabled="item.disabled"
    :class="[
      'core-dropdown-menu__item',
      { 'core-dropdown-menu__item--disabled': item.disabled },
    ]"
    @click="$emit('item-click', item)"
  >
    <!-- Left icon -->
    <template v-if="item.icon" v-slot:prepend>
      <v-icon
        :icon="item.icon"
        size="16"
        class="core-dropdown-menu__item-icon"
      />
    </template>

    <!-- Item content -->
    <v-list-item-title class="core-dropdown-menu__item-title">
      {{ item.title }}
    </v-list-item-title>

    <!-- Right icon/content -->
    <template v-if="item.rightIcon || item.rightContent" v-slot:append>
      <v-icon
        v-if="item.rightIcon"
        :icon="item.rightIcon"
        size="16"
        class="core-dropdown-menu__item-right-icon"
      />
      <span
        v-else-if="item.rightContent"
        class="core-dropdown-menu__item-right-content"
      >
        {{ item.rightContent }}
      </span>
    </template>
  </v-list-item>
</template>

<script setup lang="ts">
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

defineProps<{
  item: DropdownItem
}>()

defineEmits<{
  'item-click': [item: DropdownItem]
}>()
</script>

<style scoped>
.core-dropdown-menu__item {
  padding: 8px 16px;
  min-height: 36px;
  transition: background-color 0.2s ease;
}

.core-dropdown-menu__item:hover {
  background-color: var(--primary-light-variant);
}

.core-dropdown-menu__item--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.core-dropdown-menu__item--disabled:hover {
  background-color: transparent;
}

.core-dropdown-menu__item-title {
  font-size: 14px;
  color: var(--subtitle);
  font-weight: 400;
}

.core-dropdown-menu__item-icon {
  color: var(--subtitle);
  margin-right: 12px;
}

.core-dropdown-menu__item-right-icon {
  color: var(--subtitle);
  margin-left: 8px;
}

.core-dropdown-menu__item-right-content {
  color: var(--subtitle);
  font-size: 12px;
  margin-left: 8px;
}
</style>
