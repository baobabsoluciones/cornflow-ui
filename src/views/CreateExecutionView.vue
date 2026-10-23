<!--
  CreateExecutionView: core's "create execution" flow on one page (`createExecution.flow: 'page'`).
  The data card on the left (where the data comes from, then its tables) and the launch panel on
  the right (name, checks, parameters, what is missing, Resolve). Everything it does goes through
  `useExecutionDraft`; an app that wants a flow of its own builds it the same way
  (docs/create-execution-flows.md).
-->
<template>
  <div
    ref="root"
    class="view-container create-execution-view"
    :class="{ 'is-narrow': narrow }"
    data-testid="create-execution-view"
  >
    <CoreTitleView
      icon="mdi-play-circle-outline"
      :title="$t('createExecution.title')"
      :description="$t('createExecution.description')"
      class="create-execution-title"
    />

    <div class="create-execution-layout" :style="{ gridTemplateColumns: columns }">
      <div ref="main" class="create-execution-main">
        <DraftBanner
          v-if="savedDraft && showDraftBanner"
          :draft="savedDraft"
          @resume="resumeDraft"
          @discard="discardDraft"
        />
        <ExecutionDataCard :draft="draft" :highlight="flashData" class="create-execution-data" />
      </div>
      <LaunchPanel
        v-model:collapsed="collapsed"
        :draft="draft"
        class="create-execution-panel"
        @go="onGo"
        @view="viewResult"
        @history="goToHistory"
      />
    </div>

    <ExitCreateExecutionDialog
      :model-value="pendingLeave !== null"
      :saving="savingDraft"
      @save="saveAndLeave"
      @leave="leaveWithoutSaving"
      @cancel="stay"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter, type NavigationGuardNext } from 'vue-router'
import { useI18n } from 'vue-i18n'
import CoreTitleView from '@cornflow-ui/core/components/core/CoreTitleView.vue'
import DraftBanner from '@cornflow-ui/core/components/create-execution/DraftBanner.vue'
import ExecutionDataCard from '@cornflow-ui/core/components/create-execution/ExecutionDataCard.vue'
import ExitCreateExecutionDialog from '@cornflow-ui/core/components/create-execution/ExitCreateExecutionDialog.vue'
import LaunchPanel from '@cornflow-ui/core/components/create-execution/LaunchPanel.vue'
import { useExecutionDraft } from '@cornflow-ui/core/composables/create-execution/useExecutionDraft'
import type { ExecutionDraft } from '@cornflow-ui/core/composables/create-execution/executionDraftStore'
import { getNavigationItemsFromConfig } from '@cornflow-ui/core/services/FrontendAutomationService'
import { showSnackbar } from '@cornflow-ui/core/services/SnackbarService'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

defineOptions({ name: 'CreateExecutionView' })

const draft = useExecutionDraft()
const store = useGeneralStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

// ── Layout ───────────────────────────────────────────────────────────────────

const root = ref<HTMLElement | null>(null)
const main = ref<HTMLElement | null>(null)
const width = ref(1440)
const collapsed = ref(false)
const narrow = computed(() => width.value < 1200)

const columns = computed(() => {
  if (collapsed.value && !draft.isLaunched) return 'minmax(0, 1fr) 56px'
  return `minmax(0, 1fr) ${narrow.value ? 320 : 380}px`
})

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  if (!root.value || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(([entry]) => {
    width.value = entry.contentRect.width
  })
  resizeObserver.observe(root.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())

// ── What is missing → the data card ──────────────────────────────────────────

const flashData = ref(false)
let flashTimer: ReturnType<typeof setTimeout> | null = null

function onGo() {
  flashData.value = true
  main.value?.scrollTo({ top: 0, behavior: 'smooth' })
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (flashData.value = false), 1800)
}

// ── Starting points: relaunch and saved draft ────────────────────────────────

/** "Create a new execution from the current input data" opens this view with the query. */
watch(
  () => route.query.editInstance,
  async (edit) => {
    if (edit !== 'true') return
    if (store.selectedExecution) draft.startFrom(store.selectedExecution)
    await router.replace({ query: {} })
  },
  { immediate: true },
)

const savedDraft = ref<ExecutionDraft | null>(null)
const showDraftBanner = computed(
  () =>
    draft.loadStatus === 'empty' &&
    draft.files.length === 0 &&
    !draft.isLaunched &&
    !draft.fromExecution,
)

async function lookForDraft() {
  savedDraft.value = await draft.readDraft()
}
onMounted(lookForDraft)
onActivated(lookForDraft)

async function resumeDraft() {
  if (!savedDraft.value) return
  await draft.resumeDraft(savedDraft.value)
  savedDraft.value = null
  showSnackbar(t('createExecution.draft.resumed'))
}

async function discardDraft() {
  await draft.discardDraft()
  savedDraft.value = null
}

// ── After launching ──────────────────────────────────────────────────────────

function viewResult() {
  const id = draft.launch.executionId
  if (!id) return
  store.setSelectedExecution(id)
  store.getLoadedExecutionTabs.forEach((tab: any) => {
    tab.selected = tab.value === id
  })
  store.incrementTabBarKey()
  const results = getNavigationItemsFromConfig(
    store.getConfigurations?.resultsData ?? {},
    '/results',
  )
  const first = results.find((item: any) => item.to) ?? results[0]?.subPages?.[0]
  router.push(first?.to ?? '/output-data')
}

function goToHistory() {
  router.push('/history-execution')
}

// ── Leaving with something half done ─────────────────────────────────────────

const pendingLeave = ref<NavigationGuardNext | null>(null)
const savingDraft = ref(false)

onBeforeRouteLeave((_to, _from, next) => {
  if (!draft.hasProgress) {
    next()
    return
  }
  pendingLeave.value = next
})

async function saveAndLeave() {
  savingDraft.value = true
  const saved = await draft.saveDraft()
  savingDraft.value = false
  if (!saved) {
    showSnackbar(t('createExecution.draft.saveError'), 'error')
    return
  }
  leave()
}

function leaveWithoutSaving() {
  leave()
}

function leave() {
  const next = pendingLeave.value
  pendingLeave.value = null
  draft.reset()
  nextTick(() => next?.())
}

function stay() {
  const next = pendingLeave.value
  pendingLeave.value = null
  next?.(false)
}
</script>

<style scoped>
/* The view fills the viewport above the tab bar and scrolls inside its columns, not as a page. */
.create-execution-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 40px - var(--app-top-offset, 0px));
  max-height: calc(100vh - 40px - var(--app-top-offset, 0px));
  min-height: 0;
  overflow: hidden;
}

.create-execution-title {
  flex: none;
}

.create-execution-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: calc(var(--spacing) * 4);
  padding-bottom: calc(var(--spacing) * 4);
  transition: grid-template-columns var(--duration-base) var(--ease-standard);
}

.create-execution-main {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3);
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.create-execution-data {
  flex: 1 0 460px;
}

.create-execution-panel {
  min-height: 0;
}
</style>
