<template>
  <div class="context-bar" data-testid="context-bar">
    <div
      v-if="showModule"
      class="context-bar__group"
      data-testid="context-bar-module"
    >
      <span class="context-bar__caption">{{ t('contextBar.module') }}</span>
      <div
        v-if="store.canSwitchSchema"
        class="context-bar__segmented"
        role="radiogroup"
        :aria-label="t('contextBar.module')"
      >
        <button
          v-for="schema in store.availableSchemas"
          :key="schema"
          type="button"
          role="radio"
          class="context-bar__segment"
          :class="{ 'is-active': schema === store.getSchemaName }"
          :aria-checked="schema === store.getSchemaName"
          :data-testid="`context-bar-schema-${schema}`"
          @click="requestSchema(schema)"
        >
          {{ schemaLabel(schema) }}
        </button>
      </div>
      <span v-else class="context-bar__pill is-static">
        <span class="context-bar__pill-value">{{
          schemaLabel(store.getSchemaName)
        }}</span>
      </span>
    </div>

    <template v-for="dimension in dimensions" :key="dimension.key">
      <span
        v-if="showModule || dimensions[0] !== dimension"
        class="context-bar__divider"
        aria-hidden="true"
      />
      <div
        class="context-bar__group"
        :data-testid="`context-bar-dimension-${dimension.key}`"
      >
        <span class="context-bar__caption">{{ text(dimension.labelKey) }}</span>
        <v-menu
          v-if="isSelectable(dimension)"
          location="bottom start"
          offset="6"
        >
          <template #activator="{ props: activator, isActive }">
            <button
              type="button"
              class="context-bar__pill"
              :class="{ 'is-open': isActive }"
              v-bind="activator"
              :data-testid="`context-bar-trigger-${dimension.key}`"
            >
              <v-icon size="18" class="context-bar__pill-icon">{{
                iconOf(dimension)
              }}</v-icon>
              <span class="context-bar__pill-value">{{
                selectedTitle(dimension)
              }}</span>
              <v-icon size="18" class="context-bar__pill-chevron">
                mdi-chevron-down
              </v-icon>
            </button>
          </template>
          <v-list density="compact" class="context-bar__menu" nav>
            <v-list-item
              v-for="item in menuItems(dimension)"
              :key="String(item.value)"
              :active="isSelected(dimension, item.value)"
              color="primary"
              :data-testid="`context-bar-option-${dimension.key}-${String(item.value)}`"
              @click="requestContext(dimension, item.value)"
            >
              <v-list-item-title>{{ item.title }}</v-list-item-title>
              <template #append>
                <v-icon
                  v-if="isSelected(dimension, item.value)"
                  size="18"
                  color="primary"
                >
                  mdi-check
                </v-icon>
              </template>
            </v-list-item>
          </v-list>
        </v-menu>
        <span v-else class="context-bar__pill is-static">
          <v-icon size="18" class="context-bar__pill-icon">{{
            iconOf(dimension)
          }}</v-icon>
          <span class="context-bar__pill-value">{{ fixedLabel(dimension) }}</span>
        </span>
      </div>
    </template>

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
import {
  readSchemaLabels,
  isSameContextValue,
} from '@cornflow-ui/core/utils/globalContext'
import { isOnInstanceDependentRoute } from '@cornflow-ui/core/utils/instanceDependentRoutes'
import type { GlobalContextDimension } from '@cornflow-ui/core/types/globalContext'

defineOptions({ name: 'CoreContextBar' })

/** Icon of a dimension that declares none. */
const DEFAULT_DIMENSION_ICON = 'mdi-tune-variant'

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

const iconOf = (dimension: GlobalContextDimension): string =>
  dimension.icon || DEFAULT_DIMENSION_ICON

const options = (dimension: GlobalContextDimension) =>
  store.globalContextOptions[dimension.key] ?? []

const isSelectable = (dimension: GlobalContextDimension): boolean =>
  options(dimension).length > 1 ||
  (dimension.allowEmpty === true && options(dimension).length > 0)

/** Entries of the dimension menu; "All" (value `null`) first when the dimension allows it. */
const menuItems = (dimension: GlobalContextDimension) => [
  ...(dimension.allowEmpty ? [{ title: t('contextBar.all'), value: null }] : []),
  ...options(dimension),
]

const selectedValue = (dimension: GlobalContextDimension): unknown =>
  store.globalContext[dimension.key] ?? null

const isSelected = (dimension: GlobalContextDimension, value: unknown): boolean => {
  const selected = selectedValue(dimension)
  return value === null || selected === null
    ? value === selected
    : isSameContextValue(value, selected)
}

const selectedTitle = (dimension: GlobalContextDimension): string =>
  menuItems(dimension).find((item) => isSelected(dimension, item.value))?.title ??
  t('contextBar.all')

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

function requestContext(dimension: GlobalContextDimension, value: unknown) {
  if (isSelected(dimension, value)) return
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
  gap: 16px;
  min-width: 0;
  height: 100%;
}

.context-bar__group {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.context-bar__caption {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--subtitle);
  white-space: nowrap;
}

.context-bar__divider {
  width: 1px;
  height: 24px;
  background-color: rgba(0, 0, 0, 0.1);
  flex: none;
}

/* Module: segmented control */
.context-bar__segmented {
  display: inline-flex;
  padding: 3px;
  gap: 2px;
  border-radius: 10px;
  background-color: color-mix(in srgb, var(--primary) 9%, #fff);
}

.context-bar__segment {
  height: 30px;
  padding: 0 16px;
  border-radius: 7px;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--primary);
  white-space: nowrap;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.context-bar__segment:hover:not(.is-active) {
  background-color: color-mix(in srgb, var(--primary) 16%, #fff);
}

.context-bar__segment.is-active {
  background-color: var(--primary);
  color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}

.context-bar__segment:focus-visible,
.context-bar__pill:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* Dimension: pill that opens the menu, or shows the only value */
.context-bar__pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  max-width: 320px;
  padding: 0 10px 0 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  background-color: #fff;
  color: var(--title);
  font-size: 0.875rem;
  white-space: nowrap;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

button.context-bar__pill:hover,
.context-bar__pill.is-open {
  border-color: var(--primary);
  background-color: color-mix(in srgb, var(--primary) 4%, #fff);
}

.context-bar__pill.is-open {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent);
}

.context-bar__pill.is-static {
  padding-right: 14px;
  border-color: transparent;
  background-color: color-mix(in srgb, var(--primary) 6%, #fff);
}

.context-bar__pill-icon {
  color: var(--primary);
}

.context-bar__pill-value {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  color: var(--title);
}

.context-bar__pill-chevron {
  color: var(--subtitle);
  transition: transform 0.15s ease;
}

.context-bar__pill.is-open .context-bar__pill-chevron {
  transform: rotate(180deg);
}

.context-bar__menu {
  min-width: 220px;
  padding: 4px;
  border-radius: 10px;
}

.context-bar__menu :deep(.v-list-item-title) {
  font-size: 0.875rem;
  font-weight: 500;
}

.context-bar__menu :deep(.v-list-item--active) {
  color: var(--primary);
  background-color: color-mix(in srgb, var(--primary) 8%, #fff);
}

.context-bar__menu :deep(.v-list-item--active > .v-list-item__overlay) {
  opacity: 0;
}
</style>
