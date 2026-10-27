<!--
  TableSourceStrip: the bar over a table that says where its data comes from and how it compares
  with its master table. Either part can be on its own; with both they sit side by side.

  - Origin: database, file, edited from the database or re-uploaded, each in its own tint. With
    `showSourceChoice`, a switch picks what the table uses: for a database table "Static mode" or
    "Update with DB"; otherwise "Excel" or "Database" (`v-model:sourceChoice`).
  - Master: while comparing, a spinner; on error, Retry; when ready, the master's name, the rows
    only in the loaded data (+N), only in the master (−N) and modified (✎N), "Compare" and a menu
    to use the master's data or save the loaded data to the master (each after a confirmation).

  <TableSourceStrip :origin="{ variant: 'file' }" v-model:source-choice="choice" show-source-choice
    :master="{ state: 'ready', name: 'Products', added: 2, removed: 1, modified: 3,
               canUseMaster: true, canSaveMaster: false }"
    @compare="openComparison" @use-master="useMaster" />
-->
<template>
  <div v-if="origin || master" class="table-source" data-testid="table-source">
    <div
      v-if="origin"
      class="table-source__origin"
      :class="`is-${origin.variant}`"
      data-testid="table-source-origin"
    >
      <CoreIcon :name="ORIGINS[origin.variant].icon" :size="16" class="table-source__icon" />
      <b class="table-source__label">{{ $t(`dataTable.source.variants.${origin.variant}.label`) }}</b>
      <span class="table-source__text" :title="originText">{{ originText }}</span>
      <CoreSegmentedControl
        v-if="showSourceChoice"
        :model-value="sourceChoice"
        :options="choiceOptions"
        size="small"
        class="table-source__choice"
        @update:model-value="emit('update:sourceChoice', String($event))"
      />
    </div>

    <div v-if="master" class="table-source__master" data-testid="table-source-master">
      <template v-if="master.state === 'comparing'">
        <CoreSpinner :size="14" />
        <span class="table-source__muted">{{ $t('dataTable.source.master.comparing') }}</span>
      </template>

      <template v-else-if="master.state === 'error'">
        <CoreIcon name="mdi-alert-circle-outline" :size="16" class="table-source__error-icon" />
        <span class="table-source__error">{{ $t('dataTable.source.master.error') }}</span>
        <CoreButton
          variant="text"
          size="small"
          icon="mdi-refresh"
          :text="$t('dataTable.source.master.retry')"
          data-testid="table-source-retry"
          @click="emit('retry')"
        />
      </template>

      <template v-else>
        <CoreIcon name="mdi-compare-horizontal" :size="16" class="table-source__muted" />
        <i18n-t keypath="dataTable.source.master.matches" tag="span" class="table-source__muted">
          <template #name>
            <b class="table-source__name">{{ master.name }}</b>
          </template>
        </i18n-t>
        <span class="table-source__pills">
          <CoreBadge
            v-for="pill in pills"
            :key="pill.key"
            size="sm"
            :tone="pill.tone"
            :label="pill.label"
            :title="pill.title"
            :data-testid="`table-source-pill-${pill.key}`"
          />
        </span>
        <span class="table-source__actions">
          <CoreButton
            variant="outlined"
            size="small"
            :text="$t('dataTable.source.master.compare')"
            data-testid="table-source-compare"
            @click="emit('compare')"
          />
          <CorePopover v-if="menuItems.length" v-model:open="menuOpen" align="end" :width="260">
            <template #trigger>
              <CoreButton
                variant="icon"
                size="small"
                icon="mdi-dots-vertical"
                :aria-label="$t('dataTable.source.master.menu')"
                :title="$t('dataTable.source.master.menu')"
                data-testid="table-source-menu"
              />
            </template>
            <CoreMenu :items="menuItems" @select="ask($event.key as Confirmation)" />
          </CorePopover>
        </span>
      </template>
    </div>

    <CoreConfirmDialog
      :model-value="confirming !== null"
      :title="confirming ? $t(`dataTable.source.master.${confirming}.title`) : ''"
      :message="
        confirming ? $t(`dataTable.source.master.${confirming}.message`, { table: master?.name }) : ''
      "
      :confirm-text="confirming ? $t(`dataTable.source.master.${confirming}.confirm`) : ''"
      :cancel-text="$t('common.cancel')"
      :confirm-color="confirming === 'saveMaster' ? 'var(--color-danger)' : undefined"
      :icon="confirming === 'saveMaster' ? 'mdi-database-export-outline' : 'mdi-database-import-outline'"
      :persistent="false"
      @confirm="confirm"
      @cancel="confirming = null"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreBadge from '@cornflow-ui/core/components/core/CoreBadge.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreMenu from '@cornflow-ui/core/components/core/CoreMenu.vue'
import type { CoreMenuItem } from '@cornflow-ui/core/components/core/CoreMenu.vue'
import CorePopover from '@cornflow-ui/core/components/core/CorePopover.vue'
import CoreSegmentedControl from '@cornflow-ui/core/components/core/CoreSegmentedControl.vue'
import CoreSpinner from '@cornflow-ui/core/components/core/CoreSpinner.vue'
import CoreConfirmDialog from '@cornflow-ui/core/components/core/table/CoreConfirmDialog.vue'
import type { CoreTone } from '@cornflow-ui/core/types/ui'

defineOptions({ name: 'TableSourceStrip' })

export type TableOriginVariant = 'database' | 'file' | 'edited' | 'reuploaded'

export interface TableOrigin {
  variant: TableOriginVariant
  /** A parameter table: the origin is chosen per parameter, not for the whole table. */
  perParameter?: boolean
}

export interface TableMasterComparison {
  state: 'comparing' | 'error' | 'ready'
  /** Title of the master table. */
  name: string
  /** Rows only in the loaded data. */
  added: number
  /** Rows only in the master. */
  removed: number
  modified: number
  canUseMaster: boolean
  canSaveMaster: boolean
}

type Confirmation = 'useMaster' | 'saveMaster'

const props = withDefaults(
  defineProps<{
    origin?: TableOrigin | null
    /** `static` / `live` for a database table, `file` / `database` for the others. */
    sourceChoice?: string
    showSourceChoice?: boolean
    master?: TableMasterComparison | null
  }>(),
  { origin: null, sourceChoice: undefined, showSourceChoice: false, master: null },
)

const emit = defineEmits<{
  'update:sourceChoice': [value: string]
  compare: []
  'use-master': []
  'save-master': []
  retry: []
}>()

const { t } = useI18n()

const ORIGINS: Record<TableOriginVariant, { icon: string }> = {
  database: { icon: 'mdi-database-outline' },
  file: { icon: 'mdi-file-outline' },
  edited: { icon: 'mdi-database-edit-outline' },
  reuploaded: { icon: 'mdi-file-replace-outline' },
}

const originText = computed(() => {
  if (!props.origin) return ''
  const text = t(`dataTable.source.variants.${props.origin.variant}.text`)
  return props.origin.perParameter ? `${text} ${t('dataTable.source.perParameter')}` : text
})

const choiceOptions = computed(() => {
  const values = props.origin?.variant === 'database' ? ['static', 'live'] : ['file', 'database']
  return values.map((value) => ({
    value,
    label: t(`dataTable.source.choice.${value}.label`),
    title: t(`dataTable.source.choice.${value}.title`),
  }))
})

const pills = computed(() => {
  const master = props.master
  if (!master) return []
  if (master.added + master.removed + master.modified === 0) {
    return [
      {
        key: 'identical',
        tone: 'success' as CoreTone,
        label: t('dataTable.source.master.identical'),
        title: t('dataTable.source.master.identicalTitle'),
      },
    ]
  }
  const all: { key: string; count: number; tone: CoreTone; prefix: string }[] = [
    { key: 'added', count: master.added, tone: 'success', prefix: '+' },
    { key: 'removed', count: master.removed, tone: 'danger', prefix: '−' },
    { key: 'modified', count: master.modified, tone: 'warning', prefix: '✎ ' },
  ]
  return all
    .filter((pill) => pill.count > 0)
    .map((pill) => ({
      key: pill.key,
      tone: pill.tone,
      label: `${pill.prefix}${pill.count}`,
      title: t(`dataTable.source.master.pills.${pill.key}`, { count: pill.count }, pill.count),
    }))
})

const menuOpen = ref(false)
const confirming = ref<Confirmation | null>(null)

const menuItems = computed<CoreMenuItem[]>(() => {
  const items: CoreMenuItem[] = []
  if (props.master?.canUseMaster) {
    items.push({
      key: 'useMaster',
      label: t('dataTable.source.master.useMaster.label'),
      icon: 'mdi-database-import-outline',
      testId: 'table-source-use-master',
    })
  }
  if (props.master?.canSaveMaster) {
    items.push({
      key: 'saveMaster',
      label: t('dataTable.source.master.saveMaster.label'),
      icon: 'mdi-database-export-outline',
      testId: 'table-source-save-master',
    })
  }
  return items
})

function ask(confirmation: Confirmation) {
  menuOpen.value = false
  confirming.value = confirmation
}

function confirm() {
  const confirmation = confirming.value
  confirming.value = null
  if (confirmation === 'useMaster') emit('use-master')
  else if (confirmation === 'saveMaster') emit('save-master')
}
</script>

<style scoped>
.table-source {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  border-bottom: 1px solid var(--color-border-subtle);
  font-family: var(--font-sans);
  font-size: var(--text-md);
}

.table-source__origin,
.table-source__master {
  display: flex;
  flex: 1 1 320px;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  min-width: 0;
  min-height: 44px;
  box-sizing: border-box;
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 4);
}

.table-source__origin {
  --origin-tint: var(--color-neutral-soft);
  --origin-ink: var(--color-text);

  background: var(--origin-tint);
  color: var(--origin-ink);
}

.table-source__origin.is-database {
  --origin-tint: var(--color-info-soft);
  --origin-ink: var(--color-info-strong);
}

.table-source__origin.is-edited {
  --origin-tint: var(--color-warning-soft);
  --origin-ink: var(--color-warning-strong);
}

.table-source__origin.is-reuploaded {
  --origin-tint: var(--color-success-soft);
  --origin-ink: var(--color-success-strong);
}

.table-source__origin + .table-source__master {
  border-left: 1px solid var(--color-border-subtle);
  background: var(--color-surface-muted);
}

.table-source__icon {
  flex: none;
}

.table-source__label {
  flex: none;
  font-weight: var(--font-weight-medium);
}

.table-source__text {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.table-source__choice {
  margin-left: auto;
}

.table-source__muted {
  color: var(--color-text-muted);
}

.table-source__name {
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.table-source__error-icon,
.table-source__error {
  color: var(--color-danger-strong);
}

.table-source__pills {
  display: flex;
  gap: calc(var(--spacing) * 1.5);
}

.table-source__actions {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1);
  margin-left: auto;
}
</style>
