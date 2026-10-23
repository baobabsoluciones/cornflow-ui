<!--
  DraftBanner: an unfinished new execution was saved as a draft; continue it or throw it away.

  <DraftBanner :draft="savedDraft" @resume="..." @discard="..." />
-->
<template>
  <div class="draft-banner" role="status" data-testid="draft-banner">
    <span class="draft-banner__icon">
      <CoreIcon name="mdi-file-clock-outline" :size="20" />
    </span>
    <div class="draft-banner__text">
      <span class="draft-banner__title">{{ $t('createExecution.draft.title') }}</span>
      <span class="draft-banner__meta">{{ meta }}</span>
    </div>
    <CoreButton variant="text" :text="$t('createExecution.draft.discard')" @click="$emit('discard')" />
    <CoreButton
      icon="mdi-restore"
      :text="$t('createExecution.draft.resume')"
      data-testid="draft-banner-resume"
      @click="$emit('resume')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import type { ExecutionDraft } from '@cornflow-ui/core/composables/create-execution/executionDraftStore'

defineOptions({ name: 'DraftBanner' })

const props = defineProps<{ draft: ExecutionDraft }>()

defineEmits<{ resume: []; discard: [] }>()

const { t } = useI18n()

const meta = computed(() => {
  const saved = new Date(props.draft.savedAt)
  const time = saved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const sameDay = saved.toDateString() === new Date().toDateString()
  const when = sameDay
    ? t('createExecution.draft.savedToday', { time })
    : t('createExecution.draft.savedOn', { date: saved.toLocaleDateString(), time })
  const parts = [props.draft.name || t('createExecution.draft.unnamed'), when]
  if (props.draft.pendingChangesCount > 0) parts.push(t('createExecution.draft.withChanges'))
  return parts.join(' · ')
})
</script>

<style scoped>
.draft-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(var(--spacing) * 3);
  padding: calc(var(--spacing) * 3) calc(var(--spacing) * 4);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  font-family: var(--font-sans);
}

.draft-banner__icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  background: var(--color-info-soft);
  color: var(--color-info);
}

.draft-banner__text {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.draft-banner__title {
  font-size: var(--text-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.draft-banner__meta {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
</style>
