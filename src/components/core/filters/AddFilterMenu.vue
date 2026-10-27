<template>
  <v-menu
    v-model="open"
    location="bottom end"
    offset="6"
    :close-on-content-click="false"
  >
    <template #activator="{ props: activator }">
      <button
        type="button"
        class="add-filter"
        v-bind="{ ...activator, ...$attrs }"
      >
        <v-icon size="18">mdi-plus</v-icon>
        <span>{{ label }}</span>
      </button>
    </template>

    <div class="filter-menu add-filter-menu">
      <v-text-field
        v-model="query"
        class="add-filter-menu__search"
        prepend-inner-icon="mdi-magnify"
        :placeholder="searchPlaceholder"
        variant="outlined"
        density="compact"
        hide-details
        autofocus
      />
      <template v-for="group in visibleGroups" :key="group.key">
        <div class="filter-menu__caption">{{ group.title }}</div>
        <button
          v-for="field in group.fields"
          :key="field.key"
          type="button"
          class="filter-menu__option"
          :data-testid="`add-filter-${field.key}`"
          @click="add(field.key)"
        >
          <v-icon size="20" class="filter-menu__radio">{{ field.icon }}</v-icon>
          <span class="filter-menu__title">{{ field.title }}</span>
        </button>
      </template>
      <div v-if="visibleGroups.length === 0" class="add-filter-menu__empty">
        {{ noMatchesText }}
      </div>
    </div>
  </v-menu>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

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

function add(key: string) {
  emit('add', key)
  open.value = false
  query.value = ''
}
</script>

<style scoped>
.add-filter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 44px;
  padding: 0 16px 0 12px;
  border: 1px solid var(--title);
  border-radius: 10px;
  background-color: #fff;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--title);
  white-space: nowrap;
  transition: background-color 0.15s ease;
}

.add-filter:hover {
  background-color: color-mix(in srgb, var(--primary) 6%, #fff);
}

.add-filter:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
</style>

<style>
.add-filter-menu {
  min-width: 300px;
}

.add-filter-menu__search {
  margin: 2px 4px 8px;
}

.add-filter-menu__empty {
  padding: 12px;
  font-size: 0.875rem;
  color: var(--subtitle);
}
</style>
