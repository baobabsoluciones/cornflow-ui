<!--
/**
 * FloatingSelectionBar component
 *
 * A floating action bar that appears when items are selected in a table.
 * Provides quick access to bulk actions like delete and clear selection.
 *
 * Features:
 * - Smooth slide animation
 * - Responsive design
 * - Consistent styling with other components
 * - Accessibility support
 * - Backdrop blur effect
 *
 * Props:
 * - selectedCount (Number): Number of selected items
 *
 * Usage examples:
 *
 * Basic usage:
 * <FloatingSelectionBar
 *   :selected-count="selectedItems.length"
 *   @clear="clearSelection"
 *   @delete="deleteSelected"
 * />
 *
 * Events:
 * - @clear: Emitted when clear selection button is clicked
 * - @delete: Emitted when delete button is clicked
 */
-->

<template>
  <v-slide-y-reverse-transition>
    <div v-if="selectedCount > 0" class="floating-selection-bar">
      <div class="selection-content">
        <div class="selection-info">
          <CoreCheckbox :model-value="true" disabled />
          <span class="selection-text">{{
            $t('table.selectedItems', { count: selectedCount })
          }}</span>
        </div>

        <div class="selection-actions">
          <v-btn
            v-if="canBulkEdit"
            variant="text"
            size="small"
            class="action-btn edit-btn"
            @click="handleBulkEdit"
          >
            <v-icon icon="mdi-pencil" size="16" />
            <span class="btn-text">{{ $t('table.bulkEdit') }}</span>
          </v-btn>

          <v-btn
            v-if="canDelete"
            variant="text"
            size="small"
            class="action-btn delete-btn"
            @click="handleDelete"
          >
            <v-icon icon="mdi-delete" size="16" />
            <span class="btn-text">{{ $t('table.filters.removeAll') }}</span>
          </v-btn>

          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            class="action-btn close-btn"
            @click="handleClear"
          />
        </div>
      </div>
    </div>
  </v-slide-y-reverse-transition>
</template>

<script setup lang="ts">
import CoreCheckbox from '@/components/core/CoreCheckbox.vue'

// Props
interface Props {
  selectedCount: number
  canBulkEdit?: boolean
  canDelete?: boolean
}

defineProps<Props>()

// Emits
const emit = defineEmits<{
  clear: []
  delete: []
  'bulk-edit': []
}>()

// Methods
const handleClear = () => {
  emit('clear')
}

const handleDelete = () => {
  emit('delete')
}

const handleBulkEdit = () => {
  emit('bulk-edit')
}
</script>

<style src="@/assets/styles/components/core/FloatingSelectionBar.css"></style>
