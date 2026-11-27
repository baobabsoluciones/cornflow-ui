<!--
  ExecutionDataFilterStrip: the bar over a table of an execution that the backend gives in parts
  (see `utils/executionDataFilter.ts`). It says which value the table shows and lets the user pick
  another one among the options of the backend, with a search box; picking one emits `pick`.

  <ExecutionDataFilterStrip :filter="execution.dataFilter" :loading="reading" @pick="readFor" />
-->
<template>
  <div class="data-filter-strip" data-testid="data-filter-strip">
    <FilterChip
      :label="title"
      icon="mdi-filter-variant"
      :value="filter.value"
      :options="options"
      :menu-width="360"
      searchable
      :search-placeholder="$t('dataTable.dataFilter.search')"
      :empty-text="$t('dataTable.dataFilter.empty')"
      data-testid="data-filter-chip"
      @pick="onPick"
    />
    <CoreSpinner v-if="loading" :size="14" data-testid="data-filter-loading" />
    <span class="data-filter-strip__hint">{{ $t('dataTable.dataFilter.hint') }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import FilterChip, {
  type FilterChipOption,
} from '@cornflow-ui/core/components/core/filters/FilterChip.vue'
import CoreSpinner from '@cornflow-ui/core/components/core/CoreSpinner.vue'
import { resolveTitleWithLocale } from '@cornflow-ui/core/utils/i18nUtils'
import type { ExecutionDataFilter } from '@cornflow-ui/core/utils/executionDataFilter'

defineOptions({ name: 'ExecutionDataFilterStrip' })

const props = withDefaults(
  defineProps<{
    filter: ExecutionDataFilter
    /** The execution is being read for a value just picked. */
    loading?: boolean
  }>(),
  { loading: false },
)

const emit = defineEmits<{ pick: [value: string] }>()

const { locale } = useI18n()

const title = computed(() =>
  resolveTitleWithLocale(props.filter.title, locale.value, props.filter.param),
)

const options = computed<FilterChipOption[]>(() =>
  props.filter.options.map((option) => ({
    value: option.value,
    title: option.label,
  })),
)

function onPick(value: unknown) {
  if (props.loading || value === null || value === undefined) return
  const picked = String(value)
  if (picked !== props.filter.value) emit('pick', picked)
}
</script>

<style scoped>
.data-filter-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  min-height: 44px;
  box-sizing: border-box;
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 4);
  border-bottom: 1px solid var(--color-border-subtle);
  font-family: var(--font-sans);
  font-size: var(--text-md);
}

.data-filter-strip__hint {
  color: var(--color-text-muted);
}
</style>
