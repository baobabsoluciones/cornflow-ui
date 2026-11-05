<!--
  WarningsPanel: the bell under the help button, with `enableWarnings`. It is marked while the
  store holds warnings, and opens them in a panel that can download them all.
-->
<template>
  <CorePopover v-model:open="open" side="left" align="start" :width="360">
    <template #trigger>
      <button
        type="button"
        :class="['warnings-panel__trigger', { 'has-warnings': hasWarnings }]"
        :aria-label="t('warnings.title')"
        :title="t('warnings.title')"
        data-testid="warnings-trigger"
      >
        <CoreIcon :name="hasWarnings ? 'mdi-bell-badge' : 'mdi-bell-outline'" :size="20" />
      </button>
    </template>
    <section class="warnings-panel" data-testid="warnings-panel">
      <header class="warnings-panel__head">
        <span class="warnings-panel__title">{{ t('warnings.title') }}</span>
        <CoreButton
          v-if="hasWarnings"
          variant="text"
          size="small"
          icon="mdi-download"
          :text="t('warnings.downloadAll')"
          :loading="downloading"
          data-testid="warnings-download"
          @click="download"
        />
      </header>
      <p v-if="!hasWarnings" class="warnings-panel__empty">{{ t('warnings.noWarnings') }}</p>
      <ul v-else class="warnings-panel__list">
        <li v-for="(warning, index) in warnings" :key="index" class="warnings-panel__item">
          {{ warning.message }}
        </li>
      </ul>
    </section>
  </CorePopover>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CorePopover from '@cornflow-ui/core/components/core/CorePopover.vue'
import WarningsRepository from '@cornflow-ui/core/repositories/WarningsRepository'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

defineOptions({ name: 'WarningsPanel' })

const repository = new WarningsRepository()
const { t } = useI18n()
const store = useGeneralStore()

const open = ref(false)
const downloading = ref(false)

const warnings = computed<{ message: string }[]>(() => store.getWarnings)
const hasWarnings = computed(() => warnings.value.length > 0)

/** Downloads every warning; a failed download leaves the panel as it was. */
async function download() {
  downloading.value = true
  try {
    await repository.downloadWarnings()
  } catch {
    // Nothing to tell: the warnings are still on screen.
  } finally {
    downloading.value = false
  }
}
</script>

<style scoped>
.warnings-panel__trigger {
  position: fixed;
  top: calc(var(--app-top-offset, 0px) + var(--spacing) * 4 + 44px);
  right: calc(var(--spacing) * 3);
  z-index: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);
}

.warnings-panel__trigger.has-warnings {
  color: var(--color-warning-strong);
}

.warnings-panel__trigger:hover,
.warnings-panel__trigger[data-state='open'] {
  background: var(--color-surface-hover);
}

.warnings-panel__trigger:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.warnings-panel {
  display: flex;
  flex-direction: column;
  max-height: 480px;
  font-family: var(--font-sans);
}

.warnings-panel__head {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--spacing) * 2);
  padding: calc(var(--spacing) * 1) calc(var(--spacing) * 1) calc(var(--spacing) * 2)
    calc(var(--spacing) * 2);
  border-bottom: 1px solid var(--color-divider);
}

.warnings-panel__title {
  font-size: var(--text-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.warnings-panel__empty {
  margin: 0;
  padding: calc(var(--spacing) * 5) calc(var(--spacing) * 2);
  font-size: var(--text-md);
  text-align: center;
  color: var(--color-text-muted);
}

.warnings-panel__list {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
  margin: 0;
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 0.5) calc(var(--spacing) * 1);
  overflow-y: auto;
  list-style: none;
}

.warnings-panel__item {
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 2.5);
  border: 1px solid var(--color-warning-border);
  border-radius: var(--radius-md);
  background: var(--color-warning-soft);
  font-size: var(--text-md);
  line-height: var(--leading-normal);
  color: var(--color-text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
