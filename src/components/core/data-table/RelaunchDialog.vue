<!--
  RelaunchDialog: launches a new execution with the data edited from another one. Asks for the
  name of the new execution (proposed by the host), sums up what changed, and reminds that the
  original execution stays as it is.

  <RelaunchDialog v-model:open="relaunchOpen" name="Plan week 43 · v2" source-name="Plan week 43"
    summary="3 changes in Lines, Demand" :busy="launching" @launch="relaunch" />
-->
<template>
  <CoreDialog
    :model-value="open"
    :title="$t('dataTable.relaunch.title')"
    icon="mdi-play-circle-outline"
    :width="480"
    :persistent="busy"
    :closable="!busy"
    @update:model-value="emit('update:open', $event)"
  >
    <form class="relaunch" @submit.prevent="launch">
      <label class="relaunch__label" for="relaunch-name">{{ $t('dataTable.relaunch.name') }}</label>
      <CoreTextField
        id="relaunch-name"
        v-model="draftName"
        :disabled="busy"
        :invalid="tried && !trimmedName"
        data-testid="relaunch-name"
      />
      <span v-if="tried && !trimmedName" class="relaunch__error">
        {{ $t('dataTable.relaunch.nameRequired') }}
      </span>
      <p v-if="summary" class="relaunch__summary" data-testid="relaunch-summary">
        <CoreIcon name="mdi-pencil-outline" :size="16" />
        {{ summary }}
      </p>
      <p class="relaunch__note">{{ $t('dataTable.relaunch.note', { name: sourceName }) }}</p>
    </form>

    <template #actions>
      <CoreButton
        variant="text"
        :text="$t('dataTable.relaunch.cancel')"
        :disabled="busy"
        @click="emit('update:open', false)"
      />
      <CoreButton
        icon="mdi-play"
        :text="$t('dataTable.relaunch.launch')"
        :loading="busy"
        :loading-text="$t('dataTable.relaunch.launching')"
        data-testid="relaunch-launch"
        @click="launch"
      />
    </template>
  </CoreDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreDialog from '@cornflow-ui/core/components/core/CoreDialog.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreTextField from '@cornflow-ui/core/components/core/CoreTextField.vue'

defineOptions({ name: 'RelaunchDialog' })

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Proposed name of the new execution. */
    name: string
    /** What changed: "3 changes in Lines, Demand". */
    summary?: string
    /** The execution the data comes from, which does not change. */
    sourceName: string
    busy?: boolean
  }>(),
  { summary: '', busy: false },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  launch: [name: string]
}>()

const draftName = ref<string | number | null>(props.name)
const tried = ref(false)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    draftName.value = props.name
    tried.value = false
  },
)

const trimmedName = computed(() => String(draftName.value ?? '').trim())

function launch() {
  tried.value = true
  if (!trimmedName.value || props.busy) return
  emit('launch', trimmedName.value)
}
</script>

<style scoped>
.relaunch {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
}

.relaunch__label {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.relaunch__error {
  font-size: var(--text-sm);
  color: var(--color-danger-strong);
}

.relaunch__summary {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  margin: calc(var(--spacing) * 2) 0 0;
  color: var(--color-text);
}

.relaunch__note {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
</style>
