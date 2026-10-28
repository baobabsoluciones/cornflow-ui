<!--
  AppDrawer: the side menu, the full height of the window.

  It heads with "New execution", filled in the app's primary colour, for a user who may create one.
  Then it keeps apart what belongs to the loaded execution from what is the same for all of them:
  the loaded execution heads a block that holds its own groups (its input data, its results and
  dashboards, the app sections that need an execution); the rest of the groups follow, below a
  divider, the history first.

  - Folded (default): a 56 px rail with the logo (with several DAGs, the initial of the active one
    on it), a round "+" to create an execution, the loaded execution (a dot in the colour of its
    state) boxed with the icons of its groups, then one icon per shared group. Resting the pointer
    on it opens the whole menu over the content; it folds again when the pointer leaves. The pin
    keeps it open.
  - Expanded: 250 px. The full logo and the pin; below, in one line, the app name and, with
    several DAGs, the active one (its label from `schemaLabels`). For a user who may switch DAG,
    that line is the module selector, which lists the DAGs to switch to; the loaded execution, with its latest ones to switch to, and its groups; the shared
    groups; the user with "Log out". The groups are an accordion, one open at a time. Pinned, the
    content moves aside (`isDrawerPinned` in the store).
  - Narrow screens: pinned, it lies over the content with a scrim, and closes with the X.

  The groups and their pages come from `useDrawerSections`, the executions from
  `useDrawerExecutions`.
-->
<template>
  <div
    v-if="pinned && isNarrow"
    class="app-drawer__scrim"
    data-testid="app-drawer-scrim"
    @click="setPinned(false)"
  />
  <aside
    v-bind="$attrs"
    class="app-drawer"
    :class="{ 'is-expanded': expanded, 'is-floating': floating, 'is-overlay': pinned && isNarrow }"
    :aria-label="$t('drawer.label')"
    data-testid="app-drawer"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
  >
    <!-- Expanded: pinned, or opened by the pointer -->
    <div v-if="expanded" class="app-drawer__panel">
      <header class="app-drawer__head">
        <div class="app-drawer__head-row">
          <img class="app-drawer__logo" :src="fullLogo" alt="" />
          <CoreButton
            variant="icon"
            :icon="pinButton.icon"
            :aria-label="pinButton.label"
            :title="pinButton.label"
            data-testid="app-drawer-pin"
            @click="togglePin"
          />
        </div>
        <CorePopover v-if="showContext && modules.canSwitch" v-model:open="moduleMenuOpen" align="start" :width="226">
          <template #trigger>
            <button type="button" class="app-drawer__context is-switcher" data-testid="app-drawer-module">
              <span v-if="appName" class="app-drawer__app-name">{{ appName }}</span>
              <span class="app-drawer__module">{{ moduleName }}</span>
              <CoreIcon :name="moduleMenuOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'" :size="16" />
            </button>
          </template>
          <CoreMenu :title="$t('modules.label')" selectable :items="moduleItems" @select="pickModule" />
        </CorePopover>
        <span v-else-if="showContext" class="app-drawer__context">
          <span v-if="appName" class="app-drawer__app-name">{{ appName }}</span>
          <span v-if="moduleName" class="app-drawer__module">{{ moduleName }}</span>
        </span>
      </header>

      <nav class="app-drawer__nav" :aria-label="$t('drawer.label')">
        <RouterLink
          v-if="canCreateExecution"
          to="/project-execution"
          class="app-drawer__create"
          data-testid="app-drawer-new-execution"
          @click="closeOnNarrow"
        >
          <CoreIcon name="mdi-plus" :size="18" />
          <span>{{ $t('drawer.newExecution') }}</span>
        </RouterLink>
        <section class="app-drawer__execution" data-testid="app-drawer-execution-block">
          <span class="app-drawer__label">{{ $t('drawer.loadedExecution') }}</span>
          <CorePopover v-model:open="selectorOpen" align="start" :width="226">
            <template #trigger>
              <button type="button" class="app-drawer__selector" data-testid="app-drawer-execution">
                <span class="app-drawer__selector-text">
                  <template v-if="executions.loaded">
                    <span class="app-drawer__selector-name">{{ executions.loaded.name }}</span>
                    <span class="app-drawer__selector-meta">
                      <span>{{ executions.loaded.date }}</span>
                      <CoreBadge
                        size="sm"
                        :tone="executions.loaded.status.tone"
                        :spin="executions.loaded.status.spin"
                        :label="executions.loaded.status.label"
                      />
                    </span>
                  </template>
                  <template v-else>
                    <span class="app-drawer__selector-name is-empty">{{ $t('drawer.noExecution') }}</span>
                    <span class="app-drawer__selector-meta">{{ $t('drawer.pickExecution') }}</span>
                  </template>
                </span>
                <CoreIcon :name="selectorOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'" :size="18" />
              </button>
            </template>
            <DrawerExecutionList
              :loaded="executions.loaded"
              :latest="executions.latest"
              :loading="executions.loadingRecent"
              :opening="executions.opening"
              @open="openExecution"
              @history="goToHistory"
            />
          </CorePopover>
          <div v-if="executionSections.length" class="app-drawer__execution-groups">
            <DrawerGroup
              v-for="section in executionSections"
              :key="section.key"
              :section="section"
              :open="openKey === section.key"
              @toggle="toggleGroup"
              @navigate="closeOnNarrow"
            />
          </div>
          <p v-else-if="!executions.loaded" class="app-drawer__hint">{{ $t('drawer.executionHint') }}</p>
        </section>

        <section v-if="generalSections.length" class="app-drawer__general" data-testid="app-drawer-general-block">
          <DrawerGroup
            v-for="section in generalSections"
            :key="section.key"
            :section="section"
            :open="openKey === section.key"
            @toggle="toggleGroup"
            @navigate="closeOnNarrow"
          />
        </section>
      </nav>

      <footer v-if="user" class="app-drawer__user">
        <button type="button" class="app-drawer__user-link" :title="$t('drawer.userSettings')" @click="goToSettings">
          <span class="app-drawer__avatar">{{ user.initial }}</span>
          <span class="app-drawer__user-text">
            <span class="app-drawer__user-name">{{ user.name }}</span>
            <span class="app-drawer__user-email">{{ user.email }}</span>
          </span>
        </button>
        <CoreButton
          variant="icon"
          icon="mdi-logout"
          :aria-label="$t('drawer.logout')"
          :title="$t('drawer.logout')"
          data-testid="app-drawer-logout"
          @click="confirmSignOut = true"
        />
      </footer>
    </div>

    <!-- Folded rail -->
    <template v-else>
      <div class="app-drawer__rail-logo">
        <img class="app-drawer__mark" :src="mainLogo" alt="" />
        <span v-if="moduleName" class="app-drawer__rail-module" :title="moduleName">{{ moduleName[0] }}</span>
      </div>

      <nav class="app-drawer__rail" :aria-label="$t('drawer.label')">
        <RouterLink
          v-if="canCreateExecution"
          to="/project-execution"
          class="app-drawer__rail-button is-create"
          :aria-label="$t('drawer.newExecution')"
          :title="$t('drawer.newExecution')"
          data-testid="app-drawer-rail-new-execution"
        >
          <CoreIcon name="mdi-plus" :size="20" />
        </RouterLink>
        <div
          v-for="block in railBlocks"
          :key="block.key"
          class="app-drawer__rail-block"
          :class="`is-${block.key}`"
        >
          <button
            v-if="block.key === 'execution'"
            type="button"
            class="app-drawer__rail-button is-boxed"
            :aria-label="$t('drawer.loadedExecution')"
            data-testid="app-drawer-rail-execution"
            @click="pinOn(null)"
          >
            <CoreIcon name="mdi-play-box-outline" :size="20" />
            <span
              v-if="executions.loaded"
              class="app-drawer__rail-dot"
              :class="`is-${executions.loaded.status.tone}`"
            />
          </button>
          <template v-for="section in block.sections" :key="section.key">
            <RouterLink
              v-if="!hasPages(section) && section.to"
              :to="section.to"
              class="app-drawer__rail-button"
              :class="{ 'is-active': isActive(section) }"
              :aria-label="section.title"
            >
              <CoreIcon :name="section.icon || 'mdi-circle-small'" :size="20" />
            </RouterLink>
            <button
              v-else
              type="button"
              class="app-drawer__rail-button"
              :class="{ 'is-active': isActive(section) }"
              :aria-label="section.title"
              @click="pinOn(section.key)"
            >
              <CoreIcon :name="section.icon || 'mdi-circle-small'" :size="20" />
            </button>
          </template>
        </div>
      </nav>

      <div v-if="user" class="app-drawer__rail-user">
        <button type="button" class="app-drawer__avatar is-button" :aria-label="user.name" @click="goToSettings">
          {{ user.initial }}
        </button>
      </div>
    </template>
  </aside>

  <CoreConfirmDialog
    :model-value="modules.confirming"
    :title="$t('modules.switchTitle')"
    :message="$t('modules.switchMessage')"
    :confirm-text="$t('modules.confirm')"
    :cancel-text="$t('modules.cancel')"
    icon="mdi-swap-horizontal"
    :persistent="false"
    data-testid="app-drawer-module-dialog"
    @confirm="modules.confirm()"
    @cancel="modules.cancel()"
  />

  <CoreConfirmDialog
    v-model="confirmSignOut"
    :title="$t('logOut.title')"
    :message="$t('logOut.message')"
    :confirm-text="$t('logOut.accept')"
    :cancel-text="$t('logOut.cancel')"
    icon="mdi-logout"
    :persistent="false"
    data-testid="app-drawer-logout-dialog"
    @confirm="signOut"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import CoreBadge from '@cornflow-ui/core/components/core/CoreBadge.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreMenu from '@cornflow-ui/core/components/core/CoreMenu.vue'
import CorePopover from '@cornflow-ui/core/components/core/CorePopover.vue'
import CoreConfirmDialog from '@cornflow-ui/core/components/core/table/CoreConfirmDialog.vue'
import DrawerExecutionList from '@cornflow-ui/core/components/app-drawer/DrawerExecutionList.vue'
import DrawerGroup from '@cornflow-ui/core/components/app-drawer/DrawerGroup.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import getAuthService from '@cornflow-ui/core/services/AuthServiceFactory'
import { showSnackbar } from '@cornflow-ui/core/services/SnackbarService'
import config from '@cornflow-ui/core/config'
import { mainLogo, fullLogo } from '@cornflow-ui/core/utils/assets'
import { getAppParameters } from '@cornflow-ui/core/utils/appParameters'
import {
  isPageActive,
  useDrawerSections,
  type DrawerPage,
  type DrawerSection,
} from '@cornflow-ui/core/composables/navigation/useDrawerSections'
import {
  useDrawerExecutions,
  type DrawerExecution,
} from '@cornflow-ui/core/composables/navigation/useDrawerExecutions'
import { useSchemaSwitch } from '@cornflow-ui/core/composables/navigation/useSchemaSwitch'

defineOptions({ name: 'CoreAppDrawer', inheritAttrs: false })

/** Below this width the pinned menu lies over the content instead of moving it aside. */
const NARROW_QUERY = '(max-width: 768px)'
/** ms the pointer rests on the rail before the menu opens, and is away before it folds. */
const OPEN_DELAY = 100
const CLOSE_DELAY = 200

const store = useGeneralStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { sections, canCreateExecution } = useDrawerSections()
const executions = reactive(useDrawerExecutions())
const modules = reactive(useSchemaSwitch())

const pinned = computed(() => Boolean(store.isDrawerPinned))
/** Opened by the pointer resting on it. */
const hovering = ref(false)
const expanded = computed(() => pinned.value || hovering.value)
const floating = computed(() => hovering.value && !pinned.value)
const selectorOpen = ref(false)
const moduleMenuOpen = ref(false)
const confirmSignOut = ref(false)
const openKey = ref<string | null>(null)

// ── Layout ───────────────────────────────────────────────────────────────────

const isNarrow = ref(false)
let narrowQuery: MediaQueryList | null = null
const onNarrowChange = (event: MediaQueryListEvent) => (isNarrow.value = event.matches)
onMounted(() => {
  if (typeof globalThis.matchMedia !== 'function') return
  narrowQuery = globalThis.matchMedia(NARROW_QUERY)
  isNarrow.value = narrowQuery.matches
  narrowQuery.addEventListener?.('change', onNarrowChange)
})
onBeforeUnmount(() => narrowQuery?.removeEventListener?.('change', onNarrowChange))

function setPinned(value: boolean) {
  store.setDrawerPinned(value)
  if (!value) hovering.value = false
}

/** Pins the menu open, on the given group. */
function pinOn(key: string | null) {
  if (key) openKey.value = key
  setPinned(true)
}

function closeOnNarrow() {
  if (isNarrow.value) setPinned(false)
}

const pinButton = computed(() => {
  if (pinned.value && isNarrow.value) return { icon: 'mdi-close', label: t('drawer.close') }
  if (pinned.value) return { icon: 'mdi-pin', label: t('drawer.unpin') }
  return { icon: 'mdi-pin-outline', label: t('drawer.pin') }
})

function togglePin() {
  setPinned(!pinned.value)
}

// ── Hover ────────────────────────────────────────────────────────────────────

let pointerInside = false
let hoverTimer: ReturnType<typeof setTimeout> | undefined

function onPointerEnter(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  pointerInside = true
  clearTimeout(hoverTimer)
  if (!hovering.value) hoverTimer = setTimeout(() => (hovering.value = true), OPEN_DELAY)
}

function onPointerLeave(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  pointerInside = false
  clearTimeout(hoverTimer)
  hoverTimer = setTimeout(fold, CLOSE_DELAY)
}

/** Something of the menu open outside it: a selector or a dialog. */
const holdsOpen = computed(
  () => selectorOpen.value || moduleMenuOpen.value || confirmSignOut.value || modules.confirming,
)

/** Folds the menu the pointer opened, unless the pointer is on it or it holds something open. */
function fold() {
  if (pointerInside || holdsOpen.value) return
  hovering.value = false
}

// Once what it held open closes, the menu folds if the pointer is not on it.
watch(holdsOpen, (held) => {
  if (!held) fold()
})

onBeforeUnmount(() => clearTimeout(hoverTimer))

// ── Header and user ──────────────────────────────────────────────────────────

const appName = computed(() => config.name || '')

/** With several DAGs, the one the session is on. */
const moduleName = computed(() =>
  store.isMultiSchemaDeployment && !store.noSchemaAccess && modules.current
    ? modules.schemaLabel(modules.current)
    : '',
)

const showContext = computed(() => Boolean(appName.value || moduleName.value))

const moduleItems = computed(() =>
  modules.schemas.map((schema: string) => ({
    key: schema,
    label: modules.schemaLabel(schema),
    selected: schema === modules.current,
    testId: `app-drawer-module-${schema}`,
  })),
)

function pickModule(item: { key: string }) {
  moduleMenuOpen.value = false
  void modules.request(item.key)
}

const user = computed(() => {
  const account = store.getUser
  const name = getAppParameters().showOpenIdUsername ? account?.fullName : account?.username
  if (!name) return null
  return { name, email: account?.email ?? '', initial: String(name)[0].toUpperCase() }
})

// ── Groups ───────────────────────────────────────────────────────────────────

const executionSections = computed(() => sections.value.filter((s) => s.scope === 'execution'))
const generalSections = computed(() => sections.value.filter((s) => s.scope === 'general'))

/** The rail: the loaded execution boxed with its groups, then the shared ones. */
const railBlocks = computed(() => [
  { key: 'execution', sections: executionSections.value },
  { key: 'general', sections: generalSections.value },
])

const hasPages = (section: DrawerSection) => (section.subPages?.length ?? 0) > 0
const isActive = (page: DrawerPage) => isPageActive(page, route.path)

function toggleGroup(key: string) {
  openKey.value = openKey.value === key ? null : key
}

// The group holding the current page opens when the page changes.
watch(
  () => [route.path, sections.value.map((s) => s.key).join('|')],
  () => {
    const current = sections.value.find((s) => hasPages(s) && isActive(s))
    if (current) openKey.value = current.key
  },
  { immediate: true },
)

// ── Executions ───────────────────────────────────────────────────────────────

// The latest executions: once the DAG is known, again when the loaded one changes, and each time
// the selector opens.
watch(
  () => [store.getSchemaName, store.selectedExecution?.executionId],
  ([schema]) => {
    if (schema) void executions.refresh()
  },
  { immediate: true },
)

watch(selectorOpen, (open) => {
  if (open) void executions.refresh()
})

async function openExecution(execution: DrawerExecution) {
  if (await executions.open(execution)) selectorOpen.value = false
}

function goToHistory() {
  selectorOpen.value = false
  closeOnNarrow()
  void router.push('/history-execution')
}

function goToSettings() {
  closeOnNarrow()
  void router.push('/user-settings')
}

async function signOut() {
  confirmSignOut.value = false
  try {
    const auth = await getAuthService()
    await auth.logout()
    void router.push('/sign-in')
    showSnackbar(t('logOut.snackbar_message_success'), 'success')
  } catch (error) {
    console.error('Logout error:', error)
    showSnackbar(t('logOut.snackbar_message_error'), 'error')
  }
}
</script>

<style scoped>
/* Above the execution tab bar, which starts where the menu ends, so the open menu covers it. */
.app-drawer {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 906;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 56px;
  border-right: 1px solid var(--color-divider);
  background: var(--color-surface);
  font-family: var(--font-sans);
  color: var(--color-text);
  overflow: hidden;
  transition: width var(--duration-base) var(--ease-standard);
}

.app-drawer.is-expanded {
  width: 250px;
}

.app-drawer.is-floating {
  box-shadow: var(--shadow-xl);
}

.app-drawer.is-overlay {
  width: min(288px, 85vw);
  box-shadow: var(--shadow-xl);
}

.app-drawer__scrim {
  position: fixed;
  inset: 0;
  z-index: 905;
  background: var(--color-scrim);
}

/* ── Expanded ────────────────────────────────────────────────────────────── */

/* As wide as the open menu from the start, so it does not reflow while the menu widens. */
.app-drawer__panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 250px;
}

.app-drawer.is-overlay .app-drawer__panel {
  width: 100%;
}

/* As tall as the rail's logo, with the icon where the rail has it, so nothing jumps on opening. */
.app-drawer__head {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-bottom: calc(var(--spacing) * 2.5);
  border-bottom: 1px solid var(--color-divider);
}

/* As tall as the rail's logo, so the logo takes its place on opening. */
.app-drawer__head-row {
  align-self: stretch;
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  height: 56px;
  padding: 0 calc(var(--spacing) * 2) 0 calc(var(--spacing) * 4);
}

.app-drawer__logo {
  flex: 1;
  min-width: 0;
  display: block;
  height: 28px;
  object-fit: contain;
  object-position: left;
}

/* The app name and the active DAG, in one line; for a user who may switch DAG, a pill to do it. */
.app-drawer__context {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--spacing) * 1);
  max-width: calc(100% - var(--spacing) * 6);
  margin: calc(var(--spacing) * -1) calc(var(--spacing) * 3) 0;
  padding: 0 calc(var(--spacing) * 1);
  font-size: var(--text-sm);
  line-height: 1.4;
  white-space: nowrap;
}

.app-drawer__context.is-switcher {
  height: 28px;
  padding: 0 calc(var(--spacing) * 2) 0 calc(var(--spacing) * 3);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  font-family: inherit;
  color: inherit;
  cursor: pointer;
}

.app-drawer__context.is-switcher:hover {
  border-color: var(--color-border-strong);
}

.app-drawer__context .core-icon {
  flex: none;
  color: var(--color-text-subtle);
}

.app-drawer__app-name,
.app-drawer__module {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-drawer__app-name {
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

/* With the DAG beside it, the name keeps most of the line and the DAG gets the rest. */
.app-drawer__app-name:has(+ .app-drawer__module) {
  flex: none;
  max-width: 60%;
}

.app-drawer__module {
  color: var(--color-text-muted);
}

.app-drawer__app-name + .app-drawer__module::before {
  content: '·';
  margin-right: calc(var(--spacing) * 1);
  color: var(--color-text-subtle);
}

.app-drawer__nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: calc(var(--spacing) * 2);
}

/* Creating an execution heads the menu, filled in the app's primary colour. */
.app-drawer__create {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(var(--spacing) * 1.5);
  height: 40px;
  margin: calc(var(--spacing) * 3) calc(var(--spacing) * 2.5) 0;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  box-shadow: var(--shadow-sm);
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
}

/* The app's stylesheet colours every link (`!important`), so the label and icon take theirs. */
.app-drawer__create > *,
.app-drawer__rail-button.is-create > * {
  color: var(--color-on-primary);
}

.app-drawer__create:hover,
.app-drawer__rail-button.is-create:hover {
  filter: brightness(0.92);
}

.app-drawer__create:focus-visible,
.app-drawer__rail-button.is-create:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* The loaded execution and its groups, boxed together. */
.app-drawer__execution {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
  margin: calc(var(--spacing) * 3) calc(var(--spacing) * 2.5) 0;
  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 2.5) calc(var(--spacing) * 2.5);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
  overflow: hidden;
}

.app-drawer__execution-groups {
  margin: calc(var(--spacing) * 1) calc(var(--spacing) * -2.5) calc(var(--spacing) * -2.5);
  padding: calc(var(--spacing) * 1) 0;
  border-top: 1px solid var(--color-border-subtle);
}

.app-drawer__hint {
  margin: 0;
  padding: 0 2px;
  font-size: var(--text-xs);
  line-height: 1.45;
  color: var(--color-text-muted);
}

.app-drawer__general {
  display: flex;
  flex-direction: column;
  margin-top: calc(var(--spacing) * 3);
  padding-top: calc(var(--spacing) * 2);
  border-top: 1px solid var(--color-divider);
}

.app-drawer__label {
  padding-left: 2px;
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.app-drawer__selector {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  width: 100%;
  padding: calc(var(--spacing) * 1.75) calc(var(--spacing) * 2) calc(var(--spacing) * 1.75) calc(var(--spacing) * 2.5);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.app-drawer__selector:hover {
  border-color: var(--color-border-strong);
}

.app-drawer__selector > .core-icon {
  flex: none;
  color: var(--color-text-subtle);
}

.app-drawer__selector-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.app-drawer__selector-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
}

.app-drawer__selector-name.is-empty {
  color: var(--color-text-muted);
}

.app-drawer__selector-meta {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  white-space: nowrap;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.app-drawer__user {
  flex: none;
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1);
  height: 56px;
  padding: 0 calc(var(--spacing) * 2) 0 calc(var(--spacing) * 3);
  border-top: 1px solid var(--color-divider);
}

.app-drawer__user-link {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2.5);
  padding: calc(var(--spacing) * 1);
  border: 0;
  border-radius: var(--radius-md);
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.app-drawer__user-link:hover {
  background: var(--color-surface-hover);
}

.app-drawer__avatar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-on-primary);
}

.app-drawer__avatar.is-button {
  cursor: pointer;
}

.app-drawer__user-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.app-drawer__user-name,
.app-drawer__user-email {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-drawer__user-name {
  font-size: var(--text-sm);
}

.app-drawer__user-email {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

/* ── Folded rail ─────────────────────────────────────────────────────────── */

.app-drawer__rail-logo {
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56px;
}

/* The initial of the active DAG, on the corner of the icon. */
.app-drawer__rail-module {
  position: absolute;
  right: 6px;
  bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  border: 2px solid var(--color-surface);
  border-radius: var(--radius-full);
  background: var(--color-primary);
  font-size: 9px;
  font-weight: var(--font-weight-bold);
  line-height: 1;
  color: var(--color-on-primary);
  text-transform: uppercase;
}

.app-drawer__mark {
  flex: none;
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.app-drawer__rail {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--spacing) * 3);
  padding: calc(var(--spacing) * 1) 0 calc(var(--spacing) * 2);
  border-top: 1px solid var(--color-divider);
}

.app-drawer__rail-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--spacing) * 1);
}

/* The loaded execution and its groups, boxed together as in the expanded menu. */
.app-drawer__rail-block.is-execution {
  margin-top: calc(var(--spacing) * 1);
  padding: calc(var(--spacing) * 1);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
}

.app-drawer__rail-button {
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: var(--radius-md);
  background: none;
  color: var(--color-text-muted);
  text-decoration: none;
  cursor: pointer;
}

.app-drawer__rail-button:hover {
  background: var(--color-surface-hover);
  color: var(--color-primary);
}

.app-drawer__rail-button.is-boxed {
  border: 1px solid var(--color-border-input);
  background: var(--color-surface);
  color: var(--color-primary);
}

.app-drawer__rail-button.is-active {
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}

.app-drawer__rail-button.is-create {
  margin-top: calc(var(--spacing) * 1);
  border-radius: var(--radius-full);
  background: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.app-drawer__rail-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  border: 2px solid var(--color-surface);
  border-radius: var(--radius-full);
  background: var(--color-neutral);
}

.app-drawer__rail-dot.is-success {
  background: var(--color-success);
}

.app-drawer__rail-dot.is-warning {
  background: var(--color-warning);
}

.app-drawer__rail-dot.is-danger {
  background: var(--color-danger);
}

.app-drawer__rail-dot.is-primary {
  background: var(--color-primary);
}

.app-drawer__rail-dot.is-info {
  background: var(--color-info);
}

.app-drawer__rail-user {
  flex: none;
  display: flex;
  justify-content: center;
  padding: calc(var(--spacing) * 3) 0;
  border-top: 1px solid var(--color-divider);
}
</style>
