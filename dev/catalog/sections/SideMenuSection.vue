<template>
  <div class="catalog-section">
    <h1 class="catalog-section__title">Side menu</h1>
    <p class="catalog-section__lead">
      The side menu (<code>src/components/AppDrawer.vue</code>) and its pieces, with sample groups
      and executions. Each menu runs on a store of its own; rest the pointer on the folded one to
      open it over the content.
    </p>

    <CatalogBlock
      name="AppDrawer"
      api="no props: it reads the store (pinned, loaded execution, DAGs, user) and the route"
      note="Folded; pinned with no execution loaded; pinned with one loaded. It heads with &quot;New execution&quot;; with several DAGs, the line under the logo is the module selector."
      column
    >
      <label class="toggle">
        <input v-model="severalDags" type="checkbox" />
        Several DAGs
      </label>
      <div class="drawers">
        <div v-for="sample in drawerSamples" :key="sample.key" class="sample">
          <span class="caption">{{ sample.label }}</span>
          <div
            :ref="(el) => (frames[sample.key] = el as HTMLElement | null)"
            class="drawer-frame"
            :class="{ 'is-folded': !sample.pinned }"
          />
        </div>
      </div>
    </CatalogBlock>

    <CatalogBlock
      name="DrawerGroup"
      api="section · open → toggle, navigate"
      note="A group that is a page of its own; a closed group holding the current page; an open one."
    >
      <div class="group-frame">
        <DrawerGroup
          v-for="section in groupSamples"
          :key="section.key"
          :section="section"
          :open="openGroup === section.key"
          @toggle="openGroup = openGroup === $event ? null : $event"
        />
      </div>
    </CatalogBlock>

    <CatalogBlock
      name="DrawerExecutionList"
      api="loaded · latest · loading · opening → open, history"
      note="The panel of the execution selector: the latest executions, one being loaded; while loading; with none."
    >
      <div class="panel">
        <DrawerExecutionList
          :loaded="latest[0]"
          :latest="latest"
          :opening="opening"
          @open="opening = $event.id"
        />
      </div>
      <div class="panel">
        <DrawerExecutionList :loaded="null" :latest="[]" loading />
      </div>
      <div class="panel">
        <DrawerExecutionList :loaded="null" :latest="[]" />
      </div>
    </CatalogBlock>
  </div>
</template>

<script setup lang="ts">
import { createApp, onBeforeUnmount, onMounted, ref, watch, type App } from 'vue'
import { createPinia } from 'pinia'
import { useRouter, createMemoryHistory, createRouter } from 'vue-router'
import AppDrawer from '@cornflow-ui/core/components/AppDrawer.vue'
import DrawerExecutionList from '@cornflow-ui/core/components/app-drawer/DrawerExecutionList.vue'
import DrawerGroup from '@cornflow-ui/core/components/app-drawer/DrawerGroup.vue'
import config from '@cornflow-ui/core/config'
import appConfig from '@/app/config'
import i18n from '@cornflow-ui/core/plugins/i18n'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import type { DrawerExecution } from '@cornflow-ui/core/composables/navigation/useDrawerExecutions'
import type { DrawerSection } from '@cornflow-ui/core/composables/navigation/useDrawerSections'
import CatalogBlock from '../CatalogBlock.vue'

// ── Sample data ──────────────────────────────────────────────────────────────

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

const recentExecutions = [
  { id: 'e1', name: 'Plan week 44', createdAt: minutesAgo(3), state: 0, solution_state: { status_code: 0 } },
  { id: 'e2', name: 'Plan week 43', createdAt: minutesAgo(90), state: 1, solution_state: { status_code: 1 } },
  { id: 'e3', name: 'Plan week 43 · adjustment', createdAt: minutesAgo(600), state: 1, solution_state: { status_code: 2 } },
  { id: 'e4', name: 'Plan week 42', createdAt: minutesAgo(3000), state: -1, solution_state: { status_code: 0 } },
]

const tables = (names: Record<string, [string, string]>) =>
  Object.fromEntries(
    Object.entries(names).map(([key, [title, icon]]) => [key, { title, icon, group: null }]),
  )

const configurations = {
  masterData: tables({
    plants: ['Plants', 'mdi-factory'],
    products: ['Products', 'mdi-package-variant'],
    calendar: ['Calendar', 'mdi-calendar'],
  }),
  inputData: tables({
    demand: ['Demand', 'mdi-chart-line'],
    capacity: ['Capacity', 'mdi-gauge'],
  }),
  resultsData: tables({
    production: ['Production plan', 'mdi-calendar-check'],
    stock: ['Stock', 'mdi-warehouse'],
  }),
}

function loadedExecution(id: string) {
  const execution = recentExecutions.find((e) => e.id === id) ?? recentExecutions[1]
  return {
    ...execution,
    executionId: execution.id,
    experiment: { instance: { data: {} }, solution: { data: {} } },
  }
}

// ── AppDrawer samples: one app each, with its own store and router ─────────────

const drawerSamples = [
  { key: 'folded', label: 'Folded, with an execution loaded', pinned: false, execution: 'e2' },
  { key: 'empty', label: 'Pinned, no execution loaded', pinned: true, execution: null },
  { key: 'loaded', label: 'Pinned, with an execution loaded', pinned: true, execution: 'e2' },
]

const severalDags = ref(false)
const frames: Record<string, HTMLElement | null> = {}
let apps: App[] = []

function mountDrawer(el: HTMLElement, sample: (typeof drawerSamples)[number]) {
  const pinia = createPinia()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }],
  })
  const app = createApp(AppDrawer).use(pinia).use(router).use(i18n)

  const store = useGeneralStore(pinia)
  store.user = { username: 'agarcia', fullName: 'Ana García', email: 'ana.garcia@example.com', roles: [] }
  store.configurations = configurations as any
  store.isDrawerPinned = sample.pinned
  if (sample.execution) {
    store.loadedExecutions = [loadedExecution(sample.execution)] as any
    store.setSelectedExecution(sample.execution)
  }
  if (severalDags.value) {
    store.schema = 'planning'
    store.availableSchemas = ['planning', 'stock']
  }
  store.fetchRecentExecutions = async () => recentExecutions as any
  store.fetchLoadedExecution = async (id: string) => {
    store.loadedExecutions.push(loadedExecution(id) as any)
    return true
  }
  store.setActiveSchema = async (schema: string) => {
    store.schema = schema
    return true
  }

  void router.push(sample.execution ? '/configuration/demand' : '/history-execution')
  app.mount(el)
  return app
}

/** The app name and, with several DAGs, the deployment's DAGs and their labels, while shown here. */
const parameters = appConfig.getCore().parameters as Record<string, any>
const saved = { name: config.name, schemas: config.schemas, schemaLabels: parameters.schemaLabels }

function mountDrawers() {
  apps.forEach((app) => app.unmount())
  config.name = saved.name || 'Planner'
  config.schemas = severalDags.value ? ['planning', 'stock'] : []
  parameters.schemaLabels = severalDags.value ? { planning: 'Planning', stock: 'Stock' } : saved.schemaLabels
  apps = drawerSamples.flatMap((sample) => {
    const el = frames[sample.key]
    return el ? [mountDrawer(el, sample)] : []
  })
}

onMounted(mountDrawers)
watch(severalDags, mountDrawers)
onBeforeUnmount(() => {
  apps.forEach((app) => app.unmount())
  config.name = saved.name
  config.schemas = saved.schemas
  parameters.schemaLabels = saved.schemaLabels
})

// ── DrawerGroup and DrawerExecutionList ───────────────────────────────────────

const router = useRouter()
void router.push('/configuration/products')

const groupSamples: DrawerSection[] = [
  { key: 'agent', scope: 'general', title: 'Assistant', icon: 'mdi-robot-outline', to: '/agent' },
  {
    key: 'master-data',
    scope: 'general',
    title: 'Master data',
    icon: 'mdi-database',
    subPages: [
      { title: 'Plants', icon: 'mdi-factory', to: '/configuration/plants' },
      { title: 'Products', icon: 'mdi-package-variant', to: '/configuration/products' },
    ],
  },
  {
    key: 'results',
    scope: 'execution',
    title: 'Results',
    icon: 'mdi-chart-box',
    subPages: [
      { title: 'Production plan', icon: 'mdi-calendar-check', to: '/results/production' },
      { title: 'Stock', icon: 'mdi-warehouse', to: '/results/stock' },
      { title: 'Dashboard', icon: 'mdi-view-dashboard', to: '/dashboard' },
    ],
  },
]
const openGroup = ref<string | null>('results')

const latest: DrawerExecution[] = [
  { id: 'e1', name: 'Plan week 44', date: '27 Oct · 10:42', status: { label: 'Running', tone: 'primary', spin: true } },
  { id: 'e2', name: 'Plan week 43', date: '27 Oct · 09:15', status: { label: 'Optimal', tone: 'success', spin: false } },
  { id: 'e3', name: 'Plan week 43 · adjustment', date: '26 Oct · 18:03', status: { label: 'Feasible', tone: 'info', spin: false } },
  { id: 'e4', name: 'Plan week 42', date: '25 Oct · 12:30', status: { label: 'Error', tone: 'danger', spin: false } },
]
const opening = ref<string | null>('e3')
</script>

<style scoped>
.catalog-section__lead {
  margin: 0;
  color: var(--color-text-muted);
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  font-size: var(--text-md);
}

.drawers {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--spacing) * 4);
}

.sample {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2);
}

.caption {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

/* The menu is fixed to the window: the transform makes the frame hold it. */
.drawer-frame {
  position: relative;
  width: 250px;
  height: 600px;
  overflow: hidden;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-background);
  transform: translateZ(0);
}

.drawer-frame.is-folded {
  width: 280px;
}

.group-frame {
  width: 250px;
  padding: calc(var(--spacing) * 2) 0;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
}

.panel {
  width: 226px;
  padding: calc(var(--spacing) * 1.5);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}
</style>
