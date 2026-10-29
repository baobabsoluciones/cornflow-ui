<!--
  ExecutionParametersForm: the parameters of a new execution (`configFields`). The ones that need
  a decision (required, or without a default) come first; the ones with a default are folded under
  "Advanced", with a one-line summary of their values. A value read from the loaded data says so.

  <ExecutionParametersForm
    :fields="draft.parameterFields"
    :values="draft.execution.config"
    :solvers="draft.showSolver ? draft.solvers : []"
    :from-data="draft.fromDataKeys"
    @change="draft.setParameter"
  />
-->
<template>
  <div class="parameters-form" data-testid="parameters-form">
    <div
      v-for="field in mainFields"
      :key="field.key"
      class="parameters-form__field"
      :class="{ 'is-highlighted': highlight === field.key }"
    >
      <div class="parameters-form__label-row">
        <label :for="idOf(field)" class="parameters-form__label">{{ field.label }}</label>
        <span
          v-if="field.required"
          class="parameters-form__required"
          :class="{ 'is-missing': isMissing(field) }"
          >{{ $t('createExecution.parameters.required') }}</span
        >
        <span v-if="isFromData(field)" class="parameters-form__from-data" :title="$t('createExecution.parameters.fromDataHint')">
          <CoreIcon name="mdi-file-document-outline" :size="12" />
          {{ $t('createExecution.parameters.fromData') }}
        </span>
      </div>
      <ParameterInput
        :field="field"
        :value="values[field.key]"
        :invalid="isMissing(field)"
        :input-id="idOf(field)"
        @change="emitChange(field, $event)"
      />
    </div>

    <div v-if="advancedFields.length > 0" class="parameters-form__advanced">
      <button
        type="button"
        class="parameters-form__advanced-toggle"
        :aria-expanded="advancedOpen"
        data-testid="parameters-advanced"
        @click="advancedOpen = !advancedOpen"
      >
        <CoreIcon :name="advancedOpen ? 'mdi-chevron-down' : 'mdi-chevron-right'" :size="18" />
        <span class="parameters-form__advanced-text">
          <span class="parameters-form__advanced-title">{{ $t('createExecution.parameters.advanced') }}</span>
          <span class="parameters-form__advanced-summary">{{ advancedSummary }}</span>
        </span>
      </button>
      <div v-if="advancedOpen" class="parameters-form__advanced-fields">
        <div v-for="field in advancedFields" :key="field.key" class="parameters-form__field">
          <div class="parameters-form__label-row">
            <label :for="idOf(field)" class="parameters-form__label">{{ field.label }}</label>
            <button
              v-if="isChanged(field)"
              type="button"
              class="parameters-form__reset"
              @click="emitChange(field, field.default)"
            >
              {{ $t('createExecution.parameters.reset') }}
            </button>
          </div>
          <ParameterInput
            :field="field"
            :value="values[field.key]"
            :input-id="idOf(field)"
            compact
            @change="emitChange(field, $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import ParameterInput, {
  type ParameterFieldView,
} from '@cornflow-ui/core/components/create-execution/ParameterInput.vue'
import { isEmptyConfigValue } from '@cornflow-ui/core/composables/create-execution/configFieldValues'
import { pickedSummary } from '@cornflow-ui/core/components/core/CoreMultiSelect.vue'

defineOptions({ name: 'ExecutionParametersForm' })

const props = withDefaults(
  defineProps<{
    /** `configFields` to show. */
    fields: any[]
    values: Record<string, any>
    /** Solvers to pick from; empty when the solver is not asked. Goes under "Advanced". */
    solvers?: string[]
    defaultSolver?: string
    /** Keys whose value was read from the loaded data. */
    fromData?: string[]
    /** Key of the field to draw attention to. */
    highlight?: string
    /** Mark the required fields that are still empty. */
    showErrors?: boolean
  }>(),
  { solvers: () => [], defaultSolver: '', fromData: () => [], highlight: '', showErrors: false },
)

const emit = defineEmits<{ change: [key: string, value: unknown] }>()

const { t } = useI18n()
const store = useGeneralStore()

/** Options of the fields fed by a frontend-automation table (`joinFrom`), by key. */
const tableOptions = ref<Record<string, { value: unknown; label: string }[]>>({})

async function loadTableOptions() {
  const withTable = props.fields.filter((field) => field.joinFrom)
  await Promise.all(
    withTable.map(async (field) => {
      const options = await store.fetchTableOptions(field.joinFrom)
      tableOptions.value = {
        ...tableOptions.value,
        [field.key]: options.map((o: any) => ({ value: o.value, label: o.title })),
      }
    }),
  )
}

// The fields can arrive with the schema, and the frontend-automation tables after them.
const tableSourcesSignature = computed(
  () =>
    `${props.fields.filter((f) => f.joinFrom).map((f) => f.key).join('|')}#${
      Object.keys(store.getConfigurations?.masterData ?? {}).length
    }`,
)
watch(tableSourcesSignature, loadTableOptions)
onMounted(loadTableOptions)

function isTimeLimitInMinutes(field: any) {
  return String(field.key).toLowerCase() === 'timelimit' && field.minutes === true
}

function viewOf(field: any): ParameterFieldView {
  const options = field.joinFrom ? (tableOptions.value[field.key] ?? []) : (field.options ?? [])
  const type =
    field.type === 'select' || options.length > 0
      ? 'options'
      : (['boolean', 'number', 'float', 'date'].includes(field.type) ? field.type : 'text')
  const suffix = isTimeLimitInMinutes(field)
    ? t('configParams.minutesSuffix')
    : field.suffix
      ? t(field.suffix)
      : ''
  return {
    key: field.key,
    label: field.title ? t(field.title) : field.key,
    type,
    options: options.map((o: any) => ({ value: o.value, label: String(o.label) })),
    multiple: Boolean(field.multiple),
    suffix,
    required: Boolean(field.required),
    default: field.default,
  }
}

const solverField = computed<ParameterFieldView | null>(() =>
  props.solvers.length > 1
    ? {
        key: 'solver',
        label: t('createExecution.parameters.solver'),
        type: 'options',
        options: props.solvers.map((s) => ({ value: s, label: s })),
        suffix: '',
        required: false,
        default: props.defaultSolver || props.solvers[0],
      }
    : null,
)

/** A field the user has to decide on: required, or with no default to fall back to. */
function needsDecision(field: ParameterFieldView) {
  return field.required || field.default === undefined
}

const views = computed(() => props.fields.map(viewOf))
const mainFields = computed(() => views.value.filter(needsDecision))
const advancedFields = computed(() => [
  ...(solverField.value ? [solverField.value] : []),
  ...views.value.filter((field) => !needsDecision(field)),
])

const advancedOpen = ref(false)

function displayValue(field: ParameterFieldView, value: unknown): string {
  if (field.type === 'boolean') {
    const answer = value ? t('createExecution.parameters.yes') : t('createExecution.parameters.no')
    return `${field.label}: ${answer.toLowerCase()}`
  }
  if (field.type === 'options') {
    const labelOf = (v: unknown) => field.options.find((o) => o.value === v)?.label
    if (Array.isArray(value)) {
      return value.length > 0 ? pickedSummary(value.map((v) => labelOf(v) ?? String(v))) : '—'
    }
    return labelOf(value) ?? '—'
  }
  if (value === null || value === undefined || value === '') return '—'
  const text = typeof value === 'number' ? String(value).replace('.', ',') : String(value)
  return field.suffix ? `${text} ${field.suffix}` : text
}

const advancedSummary = computed(() =>
  advancedFields.value.map((field) => displayValue(field, props.values[field.key])).join(' · '),
)

function idOf(field: ParameterFieldView) {
  return `execution-parameter-${field.key}`
}

function isFromData(field: ParameterFieldView) {
  return props.fromData.includes(field.key) && !isEmptyConfigValue(field as any, props.values[field.key])
}

function isMissing(field: ParameterFieldView) {
  return (
    field.required &&
    isEmptyConfigValue(field as any, props.values[field.key]) &&
    (props.showErrors || props.highlight === field.key)
  )
}

function isChanged(field: ParameterFieldView) {
  if (field.default === undefined) return false
  const value = props.values[field.key]
  return Array.isArray(value) || Array.isArray(field.default)
    ? JSON.stringify(value ?? []) !== JSON.stringify(field.default ?? [])
    : value !== field.default
}

function emitChange(field: ParameterFieldView, value: unknown) {
  emit('change', field.key, value)
}

/** Opens "Advanced" when the field to point at is inside it. */
watch(
  () => props.highlight,
  (key) => {
    if (key && advancedFields.value.some((f) => f.key === key)) advancedOpen.value = true
  },
)
</script>

<style scoped>
.parameters-form {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3.5);
  font-family: var(--font-sans);
  color: var(--color-text);
}

.parameters-form__field {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
  border-radius: var(--radius-md);
  outline: 2px solid transparent;
  outline-offset: 4px;
  transition: outline-color var(--duration-base) var(--ease-standard);
}

.parameters-form__field.is-highlighted {
  outline-color: var(--color-danger);
}

.parameters-form__label-row {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  min-height: 18px;
}

.parameters-form__label {
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
}

.parameters-form__required {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.parameters-form__required.is-missing {
  color: var(--color-danger-strong);
}

.parameters-form__from-data {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px 1px 4px;
  border-radius: var(--radius-full);
  background: var(--color-info-soft);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-info);
}

.parameters-form__advanced {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3);
  padding-top: calc(var(--spacing) * 2.5);
  border-top: 1px solid var(--color-divider);
}

.parameters-form__advanced-toggle {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  padding: calc(var(--spacing) * 1) 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.parameters-form__advanced-toggle > :first-child {
  color: var(--color-text-muted);
}

.parameters-form__advanced-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.parameters-form__advanced-title {
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
}

.parameters-form__advanced-summary {
  overflow: hidden;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.parameters-form__advanced-fields {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3.5);
  padding-left: calc(var(--spacing) * 6);
}

.parameters-form__reset {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--text-xs);
  color: var(--color-primary);
  cursor: pointer;
}
</style>
