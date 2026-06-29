<template>
  <div class="simple-list-container">
    <v-card :elevation="elevation">
      <!-- Search and Action buttons (only if there are items) -->
      <div
        v-if="items.length > 0"
        class="d-flex justify-space-between align-center ma-4 ga-2"
      >
        <!-- Search Input -->
        <div class="d-flex align-center ga-2">
          <CoreSearchInput
            v-if="enableSearch"
            :model-value="searchValue || ''"
            :placeholder="searchPlaceholder"
            @update:model-value="handleSearch"
            @search="handleSearch"
          />
        </div>

        <!-- Action Menu -->
        <div v-if="canDownloadExcel">
          <CoreDropdownMenu
            :items="actionItems"
            @item-click="handleTableActionClick"
          />
        </div>
      </div>

      <!-- Loading skeleton -->
      <div v-if="loading" class="pa-4">
        <v-skeleton-loader type="text@5"></v-skeleton-loader>
      </div>

      <!-- List of items -->
      <div
        v-else-if="filteredItems.length > 0"
        class="simple-list-content pa-4"
      >
        <div class="simple-list-items">
          <v-alert
            v-for="(item, index) in filteredItems"
            :key="index"
            type="warning"
            variant="tonal"
            class="simple-list-item"
            density="comfortable"
          >
            <div class="simple-list-item__text">
              {{ item }}
            </div>
          </v-alert>
        </div>
      </div>

      <!-- No data message -->
      <div v-else class="pa-4">
        <v-alert type="info" color="var(--primary)" class="no-data-alert">
          {{ $t('table.noDataAvailable') }}
        </v-alert>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreSearchInput from '@cornflow-ui/core/components/core/table/CoreSearchInput.vue'
import CoreDropdownMenu from '@cornflow-ui/core/components/core/CoreDropdownMenu.vue'
import useFilters from '@cornflow-ui/core/utils/useFilters'

interface Props {
  items: string[]
  loading?: boolean
  elevation?: number
  enableSearch?: boolean
  canDownloadExcel?: boolean
  searchValue?: string
  searchPlaceholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  loading: false,
  elevation: 1,
  enableSearch: true,
  canDownloadExcel: false,
  searchValue: '',
  searchPlaceholder: undefined,
})

interface Emits {
  (e: 'update:searchValue', value: string): void
  (e: 'search', value: string): void
  (e: 'download-excel'): void
}

const emit = defineEmits<Emits>()

// Composables
const { t: $t } = useI18n()

// Computed
const computedSearchPlaceholder = computed(() => {
  return props.searchPlaceholder || $t('table.searchPlaceholder')
})

const filteredItems = computed(() => {
  if (!props.searchValue || props.searchValue.trim() === '') {
    return props.items
  }

  // Use the useFilters utility to filter items
  return useFilters(
    props.items.map((item) => ({ value: item })),
    props.searchValue,
    {},
    [],
  ).map((item) => item.value)
})

const actionItems = computed(() => {
  return [
    {
      id: 'download-excel',
      title: $t('table.downloadExcelTable'),
      icon: 'mdi-download',
      disabled: false,
      action: handleDownloadExcel,
    },
  ]
})

// Methods
const handleSearch = (value: string) => {
  emit('update:searchValue', value)
  emit('search', value)
}

const handleDownloadExcel = () => {
  emit('download-excel')
}

const handleTableActionClick = (item: any) => {
  // The action is already handled by the item.action function
}
</script>

<style src="@cornflow-ui/core/assets/styles/components/core/SimpleList.css"></style>
