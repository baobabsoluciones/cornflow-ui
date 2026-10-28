<template>
  <div class="catalog-section">
    <h1 class="catalog-section__title">Search, menus and filters</h1>

    <CatalogBlock
      name="CoreSearchInput"
      api="v-model · placeholder · debounce · showShortcut · clearable · block · disabled → search, clear"
    >
      <CoreSearchInput
        v-model="search"
        placeholder="Search by name or description"
      />
      <CoreSearchInput
        model-value=""
        placeholder="Disabled"
        disabled
        :show-shortcut="false"
      />
    </CatalogBlock>

    <CatalogBlock
      name="FilterChip · DateFilterChip · AddFilterMenu"
      api="label · icon · value · options · allLabel · showCounts · removable · autoOpen → pick, remove"
      note="Open them: picking an option tints the chip; an added filter shows a cross."
    >
      <DateFilterChip
        v-model="date"
        v-model:from="from"
        v-model:to="to"
        label="Date"
        :presets="presets"
        from-label="From"
        to-label="To"
      />
      <FilterChip
        label="Plant"
        :value="plant"
        :options="plants"
        all-label="All"
        @pick="plant = $event"
      />
      <FilterChip
        v-if="addedUser"
        label="User"
        icon="mdi-account-outline"
        :value="user"
        :options="users"
        all-label="All"
        show-counts
        removable
        remove-label="Remove filter"
        @pick="user = $event"
        @remove="addedUser = false"
      />
      <AddFilterMenu
        label="Add filter"
        search-placeholder="Search field…"
        no-matches-text="No field matches"
        :groups="addGroups"
        @add="addedUser = true"
      />
    </CatalogBlock>

    <CatalogBlock
      name="CoreMenu"
      api="title · items · selectable · searchable · v-model:query · emptyText · backLabel → select, back"
    >
      <div class="panel">
        <CoreMenu
          v-model:query="query"
          title="Add filter"
          searchable
          search-placeholder="Search field…"
          empty-text="No field matches"
          :items="fieldItems"
        />
      </div>
      <div class="panel">
        <CoreMenu
          title="Execution state"
          selectable
          back-label="Back"
          :items="valueItems"
        />
      </div>
    </CatalogBlock>

    <CatalogBlock
      name="CorePopover · CorePopoverPanel"
      api="v-model:open · side · align · width · #trigger · #default({ close })"
      note="CorePopoverPanel is the floating panel itself; the popover and the filter chips draw their content in it."
    >
      <CorePopover :width="260">
        <template #trigger>
          <button type="button" class="trigger">Open a popover</button>
        </template>
        <template #default="{ close }">
          <p class="popover-text">Any content: a menu, a small form…</p>
          <button type="button" class="trigger" @click="close">Close</button>
        </template>
      </CorePopover>
    </CatalogBlock>

    <CatalogBlock
      name="CoreDropdownMenu"
      api="items · sections · closeOnItemClick · v-model → item-click · slot activator"
      note="The menu of the actions in a view's title (CoreTitleView's dropdown)."
    >
      <CoreDropdownMenu :sections="dropdownSections" />
    </CatalogBlock>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import CoreDropdownMenu from '@cornflow-ui/core/components/core/CoreDropdownMenu.vue'
import CoreMenu from '@cornflow-ui/core/components/core/CoreMenu.vue'
import CorePopover from '@cornflow-ui/core/components/core/CorePopover.vue'
import CoreSearchInput from '@cornflow-ui/core/components/core/table/CoreSearchInput.vue'
import AddFilterMenu from '@cornflow-ui/core/components/core/filters/AddFilterMenu.vue'
import DateFilterChip from '@cornflow-ui/core/components/core/filters/DateFilterChip.vue'
import FilterChip from '@cornflow-ui/core/components/core/filters/FilterChip.vue'
import CatalogBlock from '../CatalogBlock.vue'

const search = ref('')
const dropdownSections = [
  {
    title: 'Data',
    items: [
      { title: 'Download Excel', icon: 'mdi-microsoft-excel' },
      { title: 'Upload a file', icon: 'mdi-upload' },
    ],
  },
  { items: [{ title: 'Delete the execution', icon: 'mdi-delete-outline' }] },
]
const date = ref<string | null>('lastMonth')
const from = ref<string | null>(null)
const to = ref<string | null>(null)
const presets = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7days', label: 'Last 7 days' },
  { value: 'lastMonth', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
]

const plant = ref<unknown>(null)
const plants = [
  { value: 1, title: 'North plant' },
  { value: 2, title: 'South plant' },
]

const addedUser = ref(true)
const user = ref<unknown>(null)
const users = [
  { value: 'ana', title: 'Ana García', count: 7 },
  { value: 'admin', title: 'admin', count: 5 },
]
const addGroups = [
  {
    key: 'execution',
    title: 'Execution',
    fields: [
      { key: 'state', title: 'Execution state', icon: 'mdi-progress-check' },
      { key: 'user', title: 'User', icon: 'mdi-account-outline' },
    ],
  },
  {
    key: 'solution',
    title: 'Solution',
    fields: [{ key: 'solver', title: 'Solver', icon: 'mdi-cog-outline' }],
  },
]

const query = ref('')
const fields = [
  {
    key: 'state',
    label: 'Execution state',
    icon: 'mdi-play-circle-outline',
    chevron: true,
  },
  { key: 'user', label: 'User', icon: 'mdi-account-outline', chevron: true },
  { key: 'solver', label: 'Solver', icon: 'mdi-cog-outline', chevron: true },
]
const fieldItems = computed(() =>
  fields.filter((field) =>
    field.label.toLowerCase().includes(query.value.toLowerCase()),
  ),
)
const valueItems = [
  { key: 'success', label: 'Success', count: 6 },
  { key: 'error', label: 'Error', count: 1, selected: true },
  { key: 'running', label: 'Running', count: 1 },
  { key: 'manual', label: 'Loaded manually', count: 0, disabled: true },
]
</script>

<style scoped>
.panel {
  width: 260px;
  padding: calc(var(--spacing) * 1.5);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.trigger {
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font: inherit;
  cursor: pointer;
}

.popover-text {
  margin: calc(var(--spacing) * 2);
  font-size: var(--text-md);
}
</style>
