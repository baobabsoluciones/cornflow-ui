<!--
  LaunchResult: the execution that was just launched, followed live (queued → running → how it
  ended, the same timeline as the history), with what to do next.

  <LaunchResult :execution="draft.launchedExecution" :name="draft.execution.name"
    @view="..." @another="draft.reset()" @history="..." />
-->
<template>
  <div class="launch-result" data-testid="launch-result">
    <div class="launch-result__head">
      <span class="launch-result__kicker">{{ kicker }}</span>
      <span class="launch-result__name">{{ name }}</span>
      <span class="launch-result__message">{{ message }}</span>
    </div>

    <CoreTimeline :steps="steps" />

    <div class="launch-result__actions">
      <CoreButton
        block
        icon="mdi-open-in-app"
        :text="$t('createExecution.launched.view')"
        :disabled="!finished"
        :title="finished ? '' : $t('createExecution.launched.viewWhenDone')"
        data-testid="launch-result-view"
        @click="$emit('view')"
      />
      <div class="launch-result__secondary">
        <CoreButton
          block
          variant="outlined"
          icon="mdi-plus"
          :text="$t('createExecution.launched.another')"
          data-testid="launch-result-another"
          @click="$emit('another')"
        />
        <CoreButton
          block
          variant="outlined"
          icon="mdi-history"
          :text="$t('createExecution.launched.history')"
          @click="$emit('history')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreTimeline from '@cornflow-ui/core/components/core/CoreTimeline.vue'
import { useExecutionDetails } from '@cornflow-ui/core/composables/project-execution/useExecutionDetails'

defineOptions({ name: 'LaunchResult' })

const props = defineProps<{
  name: string
  /** The loaded execution as the store follows it; null until it is fetched. */
  execution: { executionId: string; state: number; createdAt: string; config?: any; messageState?: string } | null
}>()

defineEmits<{ view: []; another: []; history: [] }>()

const { t } = useI18n()
const details = useExecutionDetails()

const QUEUED = -7
const RUNNING = 0

const state = computed(() => props.execution?.state ?? QUEUED)
const running = computed(() => state.value === QUEUED || state.value === RUNNING)
const finished = computed(() => state.value === 1 || state.value === 2)

const kicker = computed(() => {
  if (state.value === QUEUED) return t('createExecution.launched.queued')
  if (state.value === RUNNING) return t('createExecution.launched.running')
  if (state.value === 2) return t('createExecution.launched.solutionLoaded')
  if (state.value === 1) return t('createExecution.launched.finished')
  return t('createExecution.launched.failed')
})

const message = computed(() => {
  if (running.value) return t('createExecution.launched.runningHint')
  if (state.value === 2) return t('createExecution.launched.solutionLoadedHint')
  if (state.value === 1) return t('createExecution.launched.finishedHint')
  return props.execution?.messageState || t('createExecution.launched.failedHint')
})

/** Ticks while the execution runs, so the waiting and running times move. */
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
watch(
  running,
  (isRunning) => {
    if (isRunning && !timer) timer = setInterval(() => (now.value = Date.now()), 1000)
    if (!isRunning && timer) {
      clearInterval(timer)
      timer = null
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => timer && clearInterval(timer))

const steps = computed(() =>
  details.timelineSteps(
    {
      id: props.execution?.executionId ?? '',
      name: props.name,
      state: state.value,
      createdAt: props.execution?.createdAt ?? new Date(now.value).toISOString(),
      finishedAt: null,
      config: props.execution?.config ?? {},
    },
    now.value,
  ),
)
</script>

<style scoped>
.launch-result {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 4.5);
  font-family: var(--font-sans);
  color: var(--color-text);
}

.launch-result__head {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
}

.launch-result__kicker {
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.launch-result__name {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
  text-wrap: pretty;
}

.launch-result__message {
  font-size: var(--text-md);
  color: var(--color-text-muted);
  text-wrap: pretty;
}

.launch-result__actions {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2);
}

.launch-result__secondary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: calc(var(--spacing) * 2);
}
</style>
