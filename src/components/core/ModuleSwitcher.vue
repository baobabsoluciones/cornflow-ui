<template>
  <div
    v-if="store.canSwitchSchema"
    class="module-switcher"
    data-testid="module-switcher"
  >
    <span class="module-switcher__caption">{{ t('modules.label') }}</span>
    <div
      v-if="showsSegments"
      class="module-switcher__segmented"
      role="group"
      :aria-label="t('modules.label')"
    >
      <button
        v-for="schema in store.availableSchemas"
        :key="schema"
        type="button"
        class="module-switcher__segment"
        :class="{ 'is-active': schema === store.getSchemaName }"
        :aria-pressed="schema === store.getSchemaName"
        :data-testid="`module-switcher-${schema}`"
        @click="requestSchema(schema)"
      >
        {{ schemaLabel(schema) }}
      </button>
    </div>
    <v-menu v-else location="bottom start" offset="6">
      <template #activator="{ props: activator, isActive }">
        <button
          type="button"
          class="module-switcher__pill"
          :class="{ 'is-open': isActive }"
          v-bind="activator"
          data-testid="module-switcher-trigger"
        >
          <v-icon size="18" class="module-switcher__pill-icon">{{
            MODULE_ICON
          }}</v-icon>
          <span class="module-switcher__pill-value">{{
            schemaLabel(store.getSchemaName)
          }}</span>
          <v-icon size="18" class="module-switcher__pill-chevron">
            mdi-chevron-down
          </v-icon>
        </button>
      </template>
      <v-list density="compact" class="module-switcher__menu" nav>
        <v-list-item
          v-for="schema in store.availableSchemas"
          :key="schema"
          :active="schema === store.getSchemaName"
          color="primary"
          :data-testid="`module-switcher-${schema}`"
          @click="requestSchema(schema)"
        >
          <v-list-item-title>{{ schemaLabel(schema) }}</v-list-item-title>
          <template #append>
            <v-icon
              v-if="schema === store.getSchemaName"
              size="18"
              color="primary"
            >
              mdi-check
            </v-icon>
          </template>
        </v-list-item>
      </v-list>
    </v-menu>

    <MBaseModal
      v-model="confirmOpen"
      :closeOnOutsideClick="false"
      :title="t('modules.switchTitle')"
      :buttons="[
        { text: t('modules.confirm'), action: 'save', class: 'primary-btn' },
        { text: t('modules.cancel'), action: 'cancel', class: 'secondary-btn' },
      ]"
      @save="confirmSwitch"
      @cancel="cancelSwitch"
      @close="cancelSwitch"
    >
      <template #content>
        <v-row class="d-flex justify-center pr-2 pl-2 pb-5 pt-3">
          <span>{{ t('modules.switchMessage') }}</span>
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
import { readSchemaLabels } from '@cornflow-ui/core/utils/schemaLabels'
import { isRouteAvailableAfterSchemaSwitch } from '@cornflow-ui/core/utils/schemaSwitchNavigation'

defineOptions({ name: 'CoreModuleSwitcher' })

/** Icon of the module menu. */
const MODULE_ICON = 'mdi-view-grid-outline'

/** Most modules shown side by side; with more, the module is picked from a menu. */
const MAX_MODULE_SEGMENTS = 4

const { t, te } = useI18n()
const store = useGeneralStore()
const route = useRoute()
const router = useRouter()

const schemaLabels = readSchemaLabels()
const pendingSchema = ref<string | null>(null)
const confirmOpen = ref(false)

const showsSegments = computed(
  () => store.availableSchemas.length <= MAX_MODULE_SEGMENTS,
)

/** Text of a DAG: its label (literal text or i18n key), or its name. */
const schemaLabel = (schema: string): string => {
  const label = schemaLabels[schema]
  if (!label) return schema
  return te(label) ? t(label) : label
}

/** Something the switch would discard: loaded executions, or an execution being created. */
const switchDiscardsWork = (): boolean =>
  store.loadedExecutions.length > 0 ||
  route.path.startsWith('/project-execution')

function requestSchema(schema: string) {
  if (!schema || schema === store.getSchemaName) return
  pendingSchema.value = schema
  if (switchDiscardsWork()) {
    confirmOpen.value = true
  } else {
    void confirmSwitch()
  }
}

function cancelSwitch() {
  confirmOpen.value = false
  pendingSchema.value = null
}

async function confirmSwitch() {
  const schema = pendingSchema.value
  confirmOpen.value = false
  pendingSchema.value = null
  if (!schema) return

  const switched = await store.setActiveSchema(schema)
  if (!switched) return
  const viewer = {
    roleNames: store.getUser?.roles?.map((role: { name: string }) => role.name) ?? [],
    schema: store.getSchemaName,
  }
  const masterData = store.configurations?.masterData ?? {}
  if (!isRouteAvailableAfterSchemaSwitch(route, masterData, viewer)) {
    // '/' resolves the default view, the new DAG's `defaultView`.
    await router.push('/')
  }
}
</script>

<style scoped>
/*
  Sits on the light band of IndexView `.app-top-bar`, tinted with the app's primary colour: the
  controls are white surfaces on it, and the picked module is the one filled with the primary.
*/
.module-switcher {
  --switcher-muted: color-mix(in srgb, var(--primary) 65%, #fff);
  --switcher-tint: color-mix(in srgb, var(--primary) 8%, #fff);
  --switcher-border: color-mix(in srgb, var(--primary) 20%, #fff);
  --switcher-border-strong: color-mix(in srgb, var(--primary) 50%, #fff);

  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  height: 100%;
}

.module-switcher__caption {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--switcher-muted);
  white-space: nowrap;
}

/* Side by side: segmented control */
.module-switcher__segmented {
  display: inline-flex;
  padding: 3px;
  gap: 2px;
  border: 1px solid var(--switcher-border);
  border-radius: 10px;
  background-color: #fff;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.06);
}

.module-switcher__segment {
  height: 28px;
  padding: 0 16px;
  border-radius: 7px;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--subtitle);
  white-space: nowrap;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.module-switcher__segment:hover:not(.is-active) {
  color: var(--primary);
  background-color: var(--switcher-tint);
}

.module-switcher__segment.is-active {
  background-color: var(--primary);
  color: #fff;
  box-shadow: 0 1px 3px color-mix(in srgb, var(--primary) 45%, transparent);
}

.module-switcher__segment:focus-visible,
.module-switcher__pill:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* Many modules: a pill that opens the menu */
.module-switcher__pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  max-width: 320px;
  padding: 0 10px 0 12px;
  border: 1px solid var(--switcher-border);
  border-radius: 10px;
  background-color: #fff;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.06);
  color: var(--title);
  font-size: 0.875rem;
  white-space: nowrap;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.module-switcher__pill:hover,
.module-switcher__pill.is-open {
  border-color: var(--switcher-border-strong);
}

.module-switcher__pill.is-open {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent);
}

.module-switcher__pill-icon {
  color: var(--primary);
}

.module-switcher__pill-value {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  color: var(--title);
}

.module-switcher__pill-chevron {
  color: var(--subtitle);
  transition: transform 0.15s ease;
}

.module-switcher__pill.is-open .module-switcher__pill-chevron {
  transform: rotate(180deg);
}

.module-switcher__menu {
  min-width: 220px;
  padding: 4px;
  border-radius: 10px;
}

.module-switcher__menu :deep(.v-list-item-title) {
  font-size: 0.875rem;
  font-weight: 500;
}

.module-switcher__menu :deep(.v-list-item--active) {
  color: var(--primary);
  background-color: color-mix(in srgb, var(--primary) 8%, #fff);
}

.module-switcher__menu :deep(.v-list-item--active > .v-list-item__overlay) {
  opacity: 0;
}
</style>
