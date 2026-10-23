<!--
  LaunchPanel: the side panel that launches a new execution. Name, data checks, parameters, the
  list of what is still missing (each item takes the user to it) and Resolve. Folded, it is a
  strip that still says whether it can launch. Once launched it follows the execution.

  <LaunchPanel v-model:collapsed="collapsed" :draft="draft" @go="onGo" @view="..." @history="..." />

  `go` is emitted for the targets that live outside the panel ('data').
-->
<template>
  <aside
    class="launch-panel"
    :class="{ 'is-collapsed': isCollapsed }"
    :aria-label="$t('createExecution.launch.title')"
    data-testid="launch-panel"
  >
    <div v-if="isCollapsed" class="launch-panel__strip">
      <CoreButton
        variant="icon"
        icon="mdi-chevron-double-left"
        :aria-label="$t('createExecution.launch.expand')"
        :title="$t('createExecution.launch.expand')"
        @click="collapsed = false"
      />
      <span
        class="launch-panel__strip-status"
        :class="draft.canLaunch ? 'is-ready' : 'is-missing'"
        :title="stripTip"
      >
        <CoreIcon :name="draft.canLaunch ? 'mdi-check' : 'mdi-alert-circle-outline'" :size="18" />
      </span>
      <span class="launch-panel__strip-label">{{ stripLabel }}</span>
      <span class="launch-panel__spacer" />
      <button
        type="button"
        class="launch-panel__strip-resolve"
        :disabled="!draft.canLaunch"
        :aria-label="$t('createExecution.launch.resolve')"
        :title="stripTip"
        @click="resolve"
      >
        <CoreIcon name="mdi-play" :size="22" />
      </button>
    </div>

    <template v-else>
      <header class="launch-panel__header">
        <CoreIcon name="mdi-rocket-launch-outline" :size="20" class="launch-panel__header-icon" />
        <h2 class="launch-panel__title">
          {{ draft.isLaunched ? $t('createExecution.launch.launchedTitle') : $t('createExecution.launch.title') }}
        </h2>
        <CoreButton
          v-if="!draft.isLaunched"
          variant="icon"
          icon="mdi-chevron-double-right"
          :aria-label="$t('createExecution.launch.collapse')"
          :title="$t('createExecution.launch.collapse')"
          @click="collapsed = true"
        />
      </header>

      <div v-if="draft.isLaunched" class="launch-panel__launched">
        <LaunchResult
          :name="draft.execution.name"
          :execution="draft.launchedExecution"
          @view="$emit('view')"
          @another="draft.reset()"
          @history="$emit('history')"
        />
      </div>

      <template v-else>
        <div class="launch-panel__body">
          <section class="launch-panel__section launch-panel__name">
            <label for="launch-panel-name" class="launch-panel__section-title">
              {{ $t('createExecution.launch.name') }}
            </label>
            <input
              id="launch-panel-name"
              ref="nameInput"
              class="launch-panel__name-input"
              :class="{ 'is-highlighted': highlight === 'name' }"
              :value="draft.execution.name"
              :disabled="draft.launch.running"
              :placeholder="$t('createExecution.launch.namePlaceholder')"
              data-testid="launch-panel-name"
              @input="draft.setName(($event.target as HTMLInputElement).value)"
            />
            <span v-if="draft.nameProposed && draft.execution.name" class="launch-panel__hint">
              {{ $t('createExecution.launch.nameProposed') }}
            </span>
            <textarea
              v-if="showDescription"
              class="launch-panel__description"
              rows="2"
              :value="draft.execution.description"
              :placeholder="$t('createExecution.launch.descriptionPlaceholder')"
              @input="draft.setDescription(($event.target as HTMLTextAreaElement).value)"
            />
            <button
              v-else
              type="button"
              class="launch-panel__link"
              @click="descriptionOpen = true"
            >
              <CoreIcon name="mdi-plus" :size="14" />
              {{ $t('createExecution.launch.addDescription') }}
            </button>
          </section>

          <section v-if="draft.hasChecks" class="launch-panel__section">
            <span class="launch-panel__section-title">{{ $t('createExecution.launch.checks') }}</span>
            <ChecksStatus
              :status="draft.checks.status"
              :results="draft.checks.results"
              :checked-at="draft.checks.checkedAt"
              :blocking="draft.blockOnCheckErrors"
              :disabled="!draft.isLoaded || draft.launch.running"
              :highlight="highlight === 'checks'"
              @run="draft.runChecks()"
            />
          </section>

          <section v-if="hasParameters" class="launch-panel__section">
            <span class="launch-panel__section-title">{{ $t('createExecution.launch.parameters') }}</span>
            <ExecutionParametersForm
              :fields="draft.parameterFields"
              :values="draft.execution.config"
              :solvers="draft.showSolver ? draft.solvers : []"
              :default-solver="draft.defaultSolver"
              :from-data="draft.fromDataKeys"
              :highlight="highlight.startsWith('param:') ? highlight.slice(6) : ''"
              :show-errors="showErrors"
              @change="draft.setParameter"
            />
          </section>
        </div>

        <footer class="launch-panel__footer">
          <div v-if="draft.missing.length > 0" class="launch-panel__missing" data-testid="launch-panel-missing">
            <span class="launch-panel__missing-title">{{ $t('createExecution.launch.missingTitle') }}</span>
            <button
              v-for="item in draft.missing"
              :key="item.key"
              type="button"
              class="launch-panel__missing-item"
              @click="go(item)"
            >
              <CoreIcon name="mdi-close-circle-outline" :size="16" class="launch-panel__missing-icon" />
              <span class="launch-panel__missing-text">{{ item.text }}</span>
              <CoreIcon name="mdi-arrow-right" :size="14" class="launch-panel__missing-arrow" />
            </button>
          </div>

          <div v-if="note && !draft.solution.enabled" class="launch-panel__note">
            <CoreIcon :name="note.icon" :size="16" />
            <span>{{ note.text }}</span>
          </div>

          <div v-if="draft.solution.enabled" class="launch-panel__solution">
            <span class="launch-panel__solution-title">{{ $t('createExecution.launch.solutionFile') }}</span>
            <span v-if="draft.solution.file && draft.solution.data" class="launch-panel__solution-file">
              <CoreIcon name="mdi-file-check-outline" :size="16" />
              {{ draft.solution.file.name }}
            </span>
            <span v-if="draft.solution.errors" class="launch-panel__solution-error">{{ solutionErrors }}</span>
            <button type="button" class="launch-panel__link" @click="solutionInput?.click()">
              {{ draft.solution.file ? $t('createExecution.launch.solutionChange') : $t('createExecution.launch.solutionPick') }}
            </button>
            <input
              ref="solutionInput"
              type="file"
              accept=".json,.xlsx,.csv"
              hidden
              @change="onSolutionPicked"
            />
          </div>

          <div class="launch-panel__resolve-row">
            <CoreButton
              block
              :icon="draft.solution.enabled ? 'mdi-file-upload-outline' : 'mdi-play'"
              :text="resolveLabel"
              :loading="draft.launch.running"
              :loading-text="launchingLabel"
              :disabled="!draft.canLaunch"
              data-testid="launch-panel-resolve"
              @click="resolve"
            />
            <CorePopover v-if="draft.developerMode" v-model:open="menuOpen" side="top" align="end">
              <template #trigger>
                <CoreButton
                  variant="outlined"
                  icon="mdi-dots-vertical"
                  :aria-label="$t('createExecution.launch.moreOptions')"
                  :title="$t('createExecution.launch.moreOptions')"
                />
              </template>
              <button type="button" class="launch-panel__menu-item" @click="toggleSolutionMode">
                <CoreIcon :name="draft.solution.enabled ? 'mdi-play-outline' : 'mdi-file-upload-outline'" :size="18" />
                {{ draft.solution.enabled ? $t('createExecution.launch.solveNormally') : $t('createExecution.launch.uploadSolution') }}
              </button>
            </CorePopover>
          </div>
        </footer>
      </template>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CorePopover from '@cornflow-ui/core/components/core/CorePopover.vue'
import ChecksStatus from '@cornflow-ui/core/components/create-execution/ChecksStatus.vue'
import ExecutionParametersForm from '@cornflow-ui/core/components/create-execution/ExecutionParametersForm.vue'
import LaunchResult from '@cornflow-ui/core/components/create-execution/LaunchResult.vue'
import type {
  ExecutionDraftController,
  MissingItem,
  MissingTarget,
} from '@cornflow-ui/core/composables/create-execution/useExecutionDraft'

defineOptions({ name: 'LaunchPanel' })

const props = defineProps<{ draft: ExecutionDraftController }>()

const emit = defineEmits<{
  /** A missing item points outside the panel. */
  go: [target: MissingTarget]
  view: []
  history: []
}>()

const collapsed = defineModel<boolean>('collapsed', { default: false })

const { t } = useI18n()

const nameInput = ref<HTMLInputElement | null>(null)
const solutionInput = ref<HTMLInputElement | null>(null)
const descriptionOpen = ref(false)
const menuOpen = ref(false)
const showErrors = ref(false)
/** Target briefly outlined after the user came to it from the missing list. */
const highlight = ref('')
let highlightTimer: ReturnType<typeof setTimeout> | null = null

const isCollapsed = computed(() => collapsed.value && !props.draft.isLaunched)
const showDescription = computed(
  () => descriptionOpen.value || Boolean(props.draft.execution.description),
)
const hasParameters = computed(
  () =>
    props.draft.showParameters &&
    (props.draft.parameterFields.length > 0 || props.draft.showSolver),
)

const stripLabel = computed(() => {
  const count = props.draft.missing.length
  return count === 0 && props.draft.canLaunch
    ? t('createExecution.launch.ready')
    : t('createExecution.launch.missingCount', { count }, count)
})
const stripTip = computed(() =>
  props.draft.canLaunch
    ? t('createExecution.launch.resolve')
    : props.draft.missing.map((m) => m.text).join(' · '),
)

const resolveLabel = computed(() => {
  if (props.draft.solution.enabled) return t('createExecution.launch.createWithSolution')
  if (props.draft.pendingChangesCount > 0 && props.draft.missing.length === 0) {
    return t('createExecution.launch.applyAndResolve')
  }
  return t('createExecution.launch.resolve')
})

const launchingLabel = computed(() => {
  switch (props.draft.launch.step) {
    case 'sync':
      return t('createExecution.launch.syncing')
    case 'solution':
      return t('createExecution.launch.uploadingSolution')
    default:
      return t('createExecution.launch.creating')
  }
})

const note = computed(() => {
  if (props.draft.missing.length > 0) return null
  const pending = props.draft.pendingChangesCount
  if (pending > 0) {
    return {
      icon: 'mdi-pencil-outline',
      text: t('createExecution.launch.pendingNote', { count: pending }, pending),
    }
  }
  if (!props.draft.hasChecks) return null
  if (props.draft.checks.status === 'none') {
    return { icon: 'mdi-information-outline', text: t('createExecution.launch.notCheckedNote') }
  }
  if (props.draft.checks.status === 'stale') {
    return { icon: 'mdi-information-outline', text: t('createExecution.launch.staleNote') }
  }
  return null
})

const solutionErrors = computed(() =>
  (props.draft.solution.errors ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
)

function flash(target: string) {
  highlight.value = target
  if (highlightTimer) clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => (highlight.value = ''), 1800)
}

async function go(item: MissingItem) {
  if (item.target === 'data') {
    emit('go', 'data')
    return
  }
  collapsed.value = false
  if (item.target.startsWith('param:')) showErrors.value = true
  flash(item.target)
  if (item.target === 'name') {
    await nextTick()
    nameInput.value?.focus()
  }
}

async function resolve() {
  if (!props.draft.canLaunch) {
    collapsed.value = false
    return
  }
  await props.draft.launchExecution()
}

function toggleSolutionMode() {
  menuOpen.value = false
  props.draft.setSolutionMode(!props.draft.solution.enabled)
}

function onSolutionPicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (file) void props.draft.setSolutionFile(file)
}
</script>

<style scoped>
.launch-panel {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  font-family: var(--font-sans);
  color: var(--color-text);
}

.launch-panel__strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--spacing) * 3);
  height: 100%;
  padding: calc(var(--spacing) * 2.5) 0;
  box-sizing: border-box;
}

.launch-panel__strip-status {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
}

.launch-panel__strip-status.is-ready {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.launch-panel__strip-status.is-missing {
  background: var(--color-danger-soft);
  color: var(--color-danger-strong);
}

.launch-panel__strip-label {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.launch-panel__spacer {
  flex: 1;
}

.launch-panel__strip-resolve {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: var(--radius-lg);
  background: var(--color-primary);
  color: var(--color-on-primary);
  cursor: pointer;
}

.launch-panel__strip-resolve:disabled {
  background: var(--color-border-strong);
  cursor: not-allowed;
}

.launch-panel__header {
  flex: none;
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  padding: calc(var(--spacing) * 3) calc(var(--spacing) * 2.5) calc(var(--spacing) * 3) calc(var(--spacing) * 4.5);
  border-bottom: 1px solid var(--color-divider);
}

.launch-panel__header-icon {
  color: var(--color-primary);
}

.launch-panel__title {
  flex: 1;
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
}

.launch-panel__launched {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: calc(var(--spacing) * 4.5);
}

.launch-panel__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.launch-panel__section {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2.5);
  padding: calc(var(--spacing) * 3.5) calc(var(--spacing) * 4.5);
}

.launch-panel__section + .launch-panel__section {
  border-top: 1px solid var(--color-divider);
}

.launch-panel__name {
  gap: calc(var(--spacing) * 1.5);
  padding-top: calc(var(--spacing) * 4);
}

.launch-panel__section-title {
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.launch-panel__name-input {
  box-sizing: border-box;
  width: 100%;
  height: 38px;
  padding: 0 calc(var(--spacing) * 2.5);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-md);
  outline: none;
  font-family: var(--font-sans);
  font-size: var(--text-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
}

.launch-panel__name-input::placeholder,
.launch-panel__description::placeholder {
  color: var(--color-text-subtle);
  font-weight: var(--font-weight-regular);
}

.launch-panel__name-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.launch-panel__name-input.is-highlighted {
  border-color: var(--color-danger);
  box-shadow: 0 0 0 2px var(--color-danger-soft);
}

.launch-panel__hint {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.launch-panel__description {
  box-sizing: border-box;
  width: 100%;
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 2.5);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-md);
  outline: none;
  font-family: var(--font-sans);
  font-size: var(--text-md);
  color: var(--color-text);
  resize: vertical;
}

.launch-panel__description:focus {
  border-color: var(--color-primary);
}

.launch-panel__link {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: calc(var(--spacing) * 1);
  padding: 2px 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--text-sm);
  color: var(--color-primary);
  cursor: pointer;
}

.launch-panel__footer {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2.5);
  padding: calc(var(--spacing) * 3.5) calc(var(--spacing) * 4.5) calc(var(--spacing) * 4);
  border-top: 1px solid var(--color-border-subtle);
  background: var(--color-surface-muted);
}

.launch-panel__missing {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1);
}

.launch-panel__missing-title {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.launch-panel__missing-item {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  padding: 3px 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--text-md);
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}

.launch-panel__missing-icon {
  color: var(--color-danger-strong);
}

.launch-panel__missing-text {
  flex: 1;
  text-wrap: pretty;
}

.launch-panel__missing-arrow {
  color: var(--color-text-subtle);
}

.launch-panel__note {
  display: flex;
  align-items: flex-start;
  gap: calc(var(--spacing) * 2);
  font-size: var(--text-sm);
  color: var(--color-text);
  text-wrap: pretty;
}

.launch-panel__solution {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 3);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.launch-panel__solution-title {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
}

.launch-panel__solution-file {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  font-size: var(--text-sm);
}

.launch-panel__solution-file :deep(.core-icon) {
  color: var(--color-success);
}

.launch-panel__solution-error {
  font-size: var(--text-sm);
  color: var(--color-danger-strong);
}

.launch-panel__resolve-row {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
}

.launch-panel__resolve-row > :first-child {
  flex: 1;
  min-width: 0;
}

.launch-panel__menu-item {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2.5);
  width: 100%;
  min-width: 260px;
  min-height: 40px;
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 2.5);
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  font: inherit;
  font-size: var(--text-md);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.launch-panel__menu-item:hover {
  background: var(--color-surface-hover);
}
</style>
