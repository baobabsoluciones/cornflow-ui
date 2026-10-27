<!--
  ChecksDetailDialog: what the data checks found, in full. The checks on the left (errors first),
  the picked one on the right as a table with the columns of the checks schema, and a search over
  its rows.

  <ChecksDetailDialog v-model="open" :results="draft.checks.results" :initial-key="key" />
-->
<template>
  <CoreDialog
    :model-value="modelValue"
    :title="$t('createExecution.checks.detailTitle')"
    icon="mdi-shield-search"
    :width="1120"
    closable
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="checks-detail" data-testid="checks-detail">
      <nav class="checks-detail__list" :aria-label="$t('createExecution.checks.detailTitle')">
        <button
          v-for="result in results"
          :key="result.key"
          type="button"
          class="checks-detail__check"
          :class="{ 'is-selected': result.key === selected?.key }"
          :title="result.title"
          @click="selectedKey = result.key"
        >
          <CoreIcon
            :name="result.kind === 'error' ? 'mdi-alert-circle' : 'mdi-alert'"
            :size="16"
            :class="`is-${result.kind === 'error' ? 'danger' : 'warning'}`"
          />
          <span class="checks-detail__check-title">{{ result.title }}</span>
          <span class="checks-detail__count">{{ result.records.length }}</span>
        </button>
      </nav>

      <section v-if="selected" class="checks-detail__main">
        <header class="checks-detail__head">
          <div class="checks-detail__heading">
            <span class="checks-detail__title">{{ selected.title }}</span>
            <span class="checks-detail__meta">
              {{
                selected.kind === 'error'
                  ? $t('createExecution.checks.errors', { count: selected.records.length }, selected.records.length)
                  : $t('createExecution.checks.warnings', { count: selected.records.length }, selected.records.length)
              }}
              <template v-if="selected.description"> · {{ selected.description }}</template>
            </span>
          </div>
          <CoreSearchInput
            v-model="search"
            class="checks-detail__search"
            :placeholder="$t('createExecution.checks.search')"
            :show-shortcut="false"
            clearable
          />
        </header>

        <div class="checks-detail__table-wrap">
          <table class="checks-detail__table">
            <thead>
              <tr>
                <th v-for="column in selected.columns" :key="column.key">{{ column.title }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(record, index) in shownRecords" :key="index">
                <td v-for="column in selected.columns" :key="column.key">{{ cellText(record[column.key]) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="filteredRecords.length === 0" class="checks-detail__empty">
            {{ $t('createExecution.checks.noMatches') }}
          </p>
        </div>

        <footer v-if="filteredRecords.length > shownRecords.length" class="checks-detail__foot">
          {{ $t('createExecution.checks.showing', { shown: shownRecords.length, total: filteredRecords.length }) }}
          <CoreButton
            variant="text"
            size="small"
            :text="$t('createExecution.checks.showMore')"
            @click="limit += PAGE"
          />
        </footer>
      </section>
    </div>
  </CoreDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreDialog from '@cornflow-ui/core/components/core/CoreDialog.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSearchInput from '@cornflow-ui/core/components/core/table/CoreSearchInput.vue'
import type { CheckResult } from '@cornflow-ui/core/composables/create-execution/useExecutionDraft'

defineOptions({ name: 'ChecksDetailDialog' })

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    results: CheckResult[]
    /** The check shown first; the first one (an error, if any) when not given. */
    initialKey?: string | null
  }>(),
  { initialKey: null },
)

defineEmits<{ 'update:modelValue': [value: boolean] }>()

/** Rows drawn at a time: a check can find thousands. */
const PAGE = 200

const selectedKey = ref<string | null>(null)
const search = ref('')
const limit = ref(PAGE)

watch(
  () => props.modelValue,
  (open) => {
    if (open) selectedKey.value = props.initialKey ?? props.results[0]?.key ?? null
  },
  { immediate: true },
)

watch(selectedKey, () => {
  search.value = ''
  limit.value = PAGE
})

const selected = computed(
  () => props.results.find((r) => r.key === selectedKey.value) ?? props.results[0] ?? null,
)

function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const filteredRecords = computed(() => {
  if (!selected.value) return []
  const term = search.value.trim().toLowerCase()
  if (!term) return selected.value.records
  return selected.value.records.filter((record) =>
    selected.value!.columns.some((c) => cellText(record[c.key]).toLowerCase().includes(term)),
  )
})

const shownRecords = computed(() => filteredRecords.value.slice(0, limit.value))
</script>

<style scoped>
.checks-detail {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: calc(var(--spacing) * 4);
  height: min(620px, calc(100vh - 180px));
  color: var(--color-text);
}

.checks-detail__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
  overflow-y: auto;
  padding-right: calc(var(--spacing) * 2);
  border-right: 1px solid var(--color-divider);
}

.checks-detail__check {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  width: 100%;
  min-height: 36px;
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 2);
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  font: inherit;
  font-size: var(--text-sm);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.checks-detail__check:hover {
  background: var(--color-surface-hover);
}

.checks-detail__check.is-selected {
  background: var(--color-primary-subtle);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

.checks-detail__check .is-danger {
  flex: none;
  color: var(--color-danger);
}

.checks-detail__check .is-warning {
  flex: none;
  color: var(--color-warning);
}

.checks-detail__check-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.checks-detail__count {
  flex: none;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
}

.checks-detail__main {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3);
  min-width: 0;
  min-height: 0;
}

.checks-detail__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: calc(var(--spacing) * 4);
}

.checks-detail__heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.checks-detail__title {
  font-size: var(--text-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
  overflow-wrap: anywhere;
}

.checks-detail__meta {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.checks-detail__search {
  flex: none;
  width: 240px;
}

.checks-detail__table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
}

.checks-detail__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
}

.checks-detail__table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3);
  border-bottom: 1px solid var(--color-border-subtle);
  background: var(--color-surface-muted);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  text-align: left;
  white-space: nowrap;
}

.checks-detail__table td {
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3);
  border-bottom: 1px solid var(--color-divider);
  color: var(--color-text);
  vertical-align: top;
  overflow-wrap: anywhere;
}

.checks-detail__table tbody tr:hover {
  background: var(--color-surface-hover);
}

.checks-detail__empty {
  margin: 0;
  padding: calc(var(--spacing) * 6);
  text-align: center;
  color: var(--color-text-muted);
}

.checks-detail__foot {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

@media (max-width: 900px) {
  .checks-detail {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }

  .checks-detail__list {
    max-height: 160px;
    padding-right: 0;
    border-right: 0;
    border-bottom: 1px solid var(--color-divider);
  }
}
</style>
