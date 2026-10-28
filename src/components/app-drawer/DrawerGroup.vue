<!--
  DrawerGroup: a group of the expanded side menu. A group that is a page of its own is a link; any
  other is a heading that opens its pages (an accordion: the menu says which one is open). Closed,
  it shows a dot when it holds the current page, and how many pages it has.

  Only its pages are listed: a group of tables is one page, whose tables show as its tabs.

  <DrawerGroup :section="section" :open="openKey === section.key" @toggle="toggle" @navigate="close" />
-->
<template>
  <div class="drawer-group">
    <RouterLink
      v-if="!hasPages && section.to"
      :to="section.to"
      class="drawer-group__head"
      :class="{ 'is-active': isActive(section) }"
      @click="$emit('navigate')"
    >
      <CoreIcon v-if="section.icon" :name="section.icon" :size="18" class="drawer-group__icon" />
      <span class="drawer-group__title">{{ section.title }}</span>
    </RouterLink>
    <template v-else>
      <button type="button" class="drawer-group__head" :aria-expanded="open" @click="$emit('toggle', section.key)">
        <CoreIcon v-if="section.icon" :name="section.icon" :size="18" class="drawer-group__icon" />
        <span class="drawer-group__title">{{ section.title }}</span>
        <span
          v-if="!open && isActive(section)"
          class="drawer-group__dot"
          :aria-label="$t('drawer.containsCurrent')"
        />
        <span v-if="!open" class="drawer-group__count">{{ pages.length }}</span>
        <CoreIcon :name="open ? 'mdi-chevron-up' : 'mdi-chevron-down'" :size="18" class="drawer-group__chevron" />
      </button>
      <ul v-if="open" class="drawer-group__pages">
        <li v-for="page in pages" :key="page.to">
          <RouterLink
            :to="page.to!"
            class="drawer-group__page"
            :class="{ 'is-active': isActive(page) }"
            :aria-current="isCurrent(page) ? 'page' : undefined"
            @click="$emit('navigate')"
          >
            <CoreIcon v-if="page.icon" :name="page.icon" :size="16" />
            <span class="drawer-group__page-title">{{ page.title }}</span>
          </RouterLink>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import {
  isPageActive,
  type DrawerPage,
  type DrawerSection,
} from '@cornflow-ui/core/composables/navigation/useDrawerSections'

defineOptions({ name: 'DrawerGroup' })

const props = defineProps<{ section: DrawerSection; open: boolean }>()

defineEmits<{ toggle: [key: string]; navigate: [] }>()

const route = useRoute()

const hasPages = computed(() => (props.section.subPages?.length ?? 0) > 0)
const isActive = (page: DrawerPage) => isPageActive(page, route.path)
const isCurrent = (page: DrawerPage) => page.to === route.path

const pages = computed(() => (props.section.subPages ?? []).filter((page) => page.to))
</script>

<style scoped>
.drawer-group__head {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2.5);
  box-sizing: border-box;
  width: 100%;
  height: 40px;
  padding: 0 calc(var(--spacing) * 3) 0 calc(var(--spacing) * 4);
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.drawer-group__head:hover {
  background: var(--color-surface-hover);
}

.drawer-group__head.is-active {
  background: var(--color-primary-subtle);
  box-shadow: inset 2px 0 0 var(--color-primary);
}

.drawer-group__icon {
  flex: none;
  color: var(--color-primary);
}

/* The app's stylesheet colours every link (`!important`), so the titles take their colour. */
.drawer-group__title {
  flex: 1;
  color: var(--color-text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-group__dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
}

.drawer-group__count {
  flex: none;
  font-size: var(--text-xs);
  font-weight: var(--font-weight-regular);
  color: var(--color-text-subtle);
}

.drawer-group__chevron {
  flex: none;
  color: var(--color-text-subtle);
}

.drawer-group__pages {
  margin: 0;
  padding: 0 0 calc(var(--spacing) * 1.5);
  list-style: none;
}

.drawer-group__page {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2.5);
  box-sizing: border-box;
  width: 100%;
  min-height: 34px;
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 3) calc(var(--spacing) * 1.5) calc(var(--spacing) * 10);
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--text-md);
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.drawer-group__page .core-icon {
  flex: none;
  color: var(--color-text-subtle);
}

.drawer-group__page:hover {
  background: var(--color-surface-hover);
}

.drawer-group__page.is-active {
  background: var(--color-primary-subtle);
  box-shadow: inset 2px 0 0 var(--color-primary);
  font-weight: var(--font-weight-medium);
}

.drawer-group__head.is-active .drawer-group__title,
.drawer-group__page.is-active .drawer-group__page-title,
.drawer-group__page.is-active .core-icon {
  color: var(--color-primary);
}

.drawer-group__page-title {
  flex: 1;
  color: var(--color-text-muted);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
