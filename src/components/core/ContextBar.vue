<template>
  <div class="context-bar" data-testid="context-bar">
    <div
      v-if="showModule"
      class="context-bar__item"
      data-testid="context-bar-module"
    >
      <span class="context-bar__label">{{ t('contextBar.module') }}</span>
      <v-btn-toggle
        v-if="store.canSwitchSchema"
        :model-value="store.getSchemaName"
        mandatory
        divided
        density="compact"
        variant="outlined"
        color="primary"
        class="context-bar__toggle"
        @update:model-value="requestSchema"
      >
        <v-btn
          v-for="schema in store.availableSchemas"
          :key="schema"
          :value="schema"
          size="small"
          :data-testid="`context-bar-schema-${schema}`"
        >
          {{ schemaLabel(schema) }}
        </v-btn>
      </v-btn-toggle>
      <span v-else class="context-bar__value">
        {{ schemaLabel(store.getSchemaName) }}
      </span>
    </div>

    <div
      v-for="dimension in dimensions"
      :key="dimension.key"
      class="context-bar__item"
      :data-testid="`context-bar-dimension-${dimension.key}`"
    >
      <span class="context-bar__label">{{ text(dimension.labelKey) }}</span>
      <v-select
        v-if="isSelectable(dimension)"
        :model-value="selectValue(dimension)"
        :items="selectItems(dimension)"
        density="compact"
        variant="outlined"
        hide-details
        class="context-bar__select"
        :data-testid="`context-bar-select-${dimension.key}`"
        @update:model-value="(value) => requestContext(dimension, value)"
      />
      <span v-else class="context-bar__value">{{ fixedLabel(dimension) }}</span>
    </div>

    <MBaseModal
      v-model="confirmOpen"
      :closeOnOutsideClick="false"
      :title="confirmTitle"
      :buttons="[
        { text: t('contextBar.confirm'), action: 'save', class: 'primary-btn' },
        { text: t('contextBar.cancel'), action: 'cancel', class: 'secondary-btn' },
      ]"
      @save="confirmChange"
      @cancel="cancelChange"
      @close="cancelChange"
    >
      <template #content>
        <v-row class="d-flex justify-center pr-2 pl-2 pb-5 pt-3">
          <span>{{ confirmMessage }}</span>
        </v-row>
      </template>
    </MBaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import { readSchemaLabels } from '@cornflow-ui/core/utils/globalContext'
import { isOnInstanceDependentRoute } from '@cornflow-ui/core/utils/instanceDependentRoutes'
import type { GlobalContextDimension } from '@cornflow-ui/core/types/globalContext'

defineOptions({ name: 'CoreContextBar' })

/** Value the selector uses for "All"; the store keeps `null`. */
const ALL = '__all__'

/** Views that do not depend on the DAG: a module switch keeps the user on them. */
const SCHEMA_INDEPENDENT_ROUTES = [
  '/history-execution',
  '/project-execution',
  '/user-settings',
  '/roles-management',
]

type PendingChange =
  | { kind: 'schema'; schema: string }
  | { kind: 'context'; dimension: GlobalContextDimension; value: unknown }

const { t, te } = useI18n()
const store = useGeneralStore()
const route = useRoute()
const router = useRouter()

const schemaLabels = readSchemaLabels()
const pending = ref<PendingChange | null>(null)
const confirmOpen = ref(false)

const showModule = computed(
  () => store.isMultiSchemaDeployment && store.availableSchemas.length > 0,
)
const dimensions = computed(() => store.getGlobalContextDimensions)

/** Literal text, or its translation when it is an i18n key. */
const text = (keyOrText: string): string =>
  keyOrText && te(keyOrText) ? t(keyOrText) : keyOrText

const schemaLabel = (schema: string): string =>
  schemaLabels[schema] ? text(schemaLabels[schema]) : schema

const options = (dimension: GlobalContextDimension) =>
  store.globalContextOptions[dimension.key] ?? []

const isSelectable = (dimension: GlobalContextDimension): boolean =>
  options(dimension).length > 1 ||
  (dimension.allowEmpty === true && options(dimension).length > 0)

const selectItems = (dimension: GlobalContextDimension) => [
  ...(dimension.allowEmpty ? [{ title: t('contextBar.all'), value: ALL }] : []),
  ...options(dimension).map((option) => ({
    title: option.title,
    value: option.value,
  })),
]

const selectValue = (dimension: GlobalContextDimension): unknown => {
  const value = store.globalContext[dimension.key]
  return value === null || value === undefined ? ALL : value
}

const fixedLabel = (dimension: GlobalContextDimension): string =>
  options(dimension)[0]?.title ?? t('contextBar.noOptions')

/** Something the change would discard: loaded executions, or an execution being created. */
const changeDiscardsWork = (): boolean =>
  store.loadedExecutions.length > 0 ||
  route.path.startsWith('/project-execution')

const confirmTitle = computed(() =>
  pending.value?.kind === 'schema'
    ? t('contextBar.switchModuleTitle')
    : t('contextBar.changeContextTitle'),
)

const confirmMessage = computed(() =>
  pending.value?.kind === 'schema'
    ? t('contextBar.switchModuleMessage')
    : t('contextBar.changeContextMessage'),
)

function request(change: PendingChange) {
  pending.value = change
  if (changeDiscardsWork()) {
    confirmOpen.value = true
  } else {
    void confirmChange()
  }
}

function requestSchema(schema: string) {
  if (!schema || schema === store.getSchemaName) return
  request({ kind: 'schema', schema })
}

function requestContext(dimension: GlobalContextDimension, selected: unknown) {
  const value = selected === ALL ? null : selected
  if (value === (store.globalContext[dimension.key] ?? null)) return
  request({ kind: 'context', dimension, value })
}

function cancelChange() {
  confirmOpen.value = false
  pending.value = null
}

async function confirmChange() {
  const change = pending.value
  confirmOpen.value = false
  pending.value = null
  if (!change) return

  if (change.kind === 'schema') {
    const switched = await store.setActiveSchema(change.schema)
    if (switched && !SCHEMA_INDEPENDENT_ROUTES.some((path) => route.path.startsWith(path))) {
      // The view on screen may not exist in the new DAG; '/' resolves the default view.
      await router.push('/')
    }
    return
  }

  const changed = await store.setGlobalContextValue(change.dimension.key, change.value)
  if (changed && !store.selectedExecution && isOnInstanceDependentRoute(route.path)) {
    await router.push('/')
  }
}
</script>

<style scoped>
.context-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  min-width: 0;
}

.context-bar__item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.context-bar__label {
  font-size: 0.8rem;
  color: var(--subtitle);
  white-space: nowrap;
}

.context-bar__value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--title);
  white-space: nowrap;
}

.context-bar__toggle {
  height: 30px !important;
}

.context-bar__select {
  min-width: 160px;
  max-width: 260px;
}

.context-bar__select :deep(.v-field__input) {
  min-height: 30px;
  padding-top: 2px;
  padding-bottom: 2px;
  font-size: 0.875rem;
}
</style>
