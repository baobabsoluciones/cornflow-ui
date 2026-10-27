<template>
  <div class="catalog">
    <aside class="catalog__nav">
      <p class="catalog__brand">Cornflow UI</p>
      <a
        v-for="section in sections"
        :key="section.id"
        :href="`#${section.id}`"
        class="catalog__link"
        :class="{ 'catalog__link--active': section.id === activeId }"
      >
        {{ section.title }}
      </a>

      <label class="catalog__primary">
        <span>App primary (<code>--primary</code>)</span>
        <input type="color" :value="primary" @input="onPrimaryInput" />
        <code>{{ primary }}</code>
      </label>
    </aside>

    <main class="catalog__main">
      <component :is="activeSection.component" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  applyTokensToTheme,
  readCssToken,
} from '@cornflow-ui/core/plugins/vuetify'
import ButtonsSection from './sections/ButtonsSection.vue'
import CreateExecutionSection from './sections/CreateExecutionSection.vue'
import DataSection from './sections/DataSection.vue'
import FormsSection from './sections/FormsSection.vue'
import HistorySection from './sections/HistorySection.vue'
import MenusSection from './sections/MenusSection.vue'
import OverlaysSection from './sections/OverlaysSection.vue'
import SideMenuSection from './sections/SideMenuSection.vue'
import StatusSection from './sections/StatusSection.vue'
import TokensSection from './sections/TokensSection.vue'

/** A page of the catalog. A component added to the core gets its own section here. */
const sections = [
  { id: 'tokens', title: 'Design tokens', component: TokensSection },
  { id: 'buttons', title: 'Buttons and icons', component: ButtonsSection },
  { id: 'status', title: 'Status and feedback', component: StatusSection },
  { id: 'forms', title: 'Form fields', component: FormsSection },
  { id: 'menus', title: 'Search, menus and filters', component: MenusSection },
  { id: 'data', title: 'Data', component: DataSection },
  { id: 'overlays', title: 'Dialogs and toasts', component: OverlaysSection },
  { id: 'history', title: 'Execution history', component: HistorySection },
  { id: 'create-execution', title: 'Create execution', component: CreateExecutionSection },
  { id: 'side-menu', title: 'Side menu', component: SideMenuSection },
]

const activeId = ref(sections[0].id)
const activeSection = computed(
  () =>
    sections.find((section) => section.id === activeId.value) ?? sections[0],
)

function syncWithHash() {
  const id = location.hash.replace('#', '')
  if (sections.some((section) => section.id === id)) activeId.value = id
}

onMounted(() => {
  syncWithHash()
  window.addEventListener('hashchange', syncWithHash)
})
onUnmounted(() => window.removeEventListener('hashchange', syncWithHash))

/** Tries another app primary, as an application would declare it in its variables.css. */
const primary = ref(readCssToken('--color-primary'))
function onPrimaryInput(event: Event) {
  primary.value = (event.target as HTMLInputElement).value
  document.body.style.setProperty('--primary', primary.value)
  applyTokensToTheme()
}
</script>

<style scoped>
.catalog {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-background);
}

.catalog__nav {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1);
  padding: calc(var(--spacing) * 6) calc(var(--spacing) * 4);
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
}

.catalog__brand {
  margin: 0 0 calc(var(--spacing) * 4);
  font-size: var(--text-lg);
  font-weight: var(--font-weight-bold);
}

.catalog__link {
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: var(--text-base);
  text-decoration: none;
}

.catalog__link--active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

.catalog__primary {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1);
  margin-top: auto;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.catalog__main {
  padding: calc(var(--spacing) * 8);
  overflow: auto;
}

.catalog__main :deep(.catalog-section) {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 5);
  max-width: 1100px;
}

.catalog__main :deep(.catalog-section__title) {
  margin: 0;
  font-size: var(--text-2xl);
  font-weight: var(--font-weight-bold);
}
</style>
