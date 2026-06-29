<template>
  <v-card class="master-table-match-card" variant="outlined">
    <v-card-title class="d-flex align-center justify-space-between">
      <div class="d-flex align-center">
        <v-icon class="mr-2" color="warning">mdi-table-sync</v-icon>
        <span class="table-name">{{ match.tableName }}</span>
        <v-chip
          v-if="match.hasDifferences"
          size="small"
          color="warning"
          class="ml-2"
        >
          {{ $t('masterTableMatch.hasDifferences') }}
        </v-chip>
        <v-chip v-else size="small" color="success" class="ml-2">
          {{ $t('masterTableMatch.identical') }}
        </v-chip>
      </div>
      <v-btn
        variant="text"
        size="small"
        color="primary"
        @click="showDiffModal = true"
      >
        <v-icon left>mdi-compare</v-icon>
        {{ $t('masterTableMatch.viewDifferences') }}
      </v-btn>
    </v-card-title>

    <v-card-subtitle class="pb-0">
      {{ $t('masterTableMatch.matchFoundWithMaster', { masterTable: match.masterTableTitle }) }}
    </v-card-subtitle>

    <v-card-text>
      <!-- Diff summary -->
      <div class="diff-summary mb-4">
        <div class="summary-row">
          <span class="summary-label">
            {{ $t('masterTableMatch.uploadedRows') }}:
          </span>
          <span class="summary-value">{{ match.diffSummary.totalInstance }}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">
            {{ $t('masterTableMatch.masterRows') }}:
          </span>
          <span class="summary-value">{{ match.diffSummary.totalMaster }}</span>
        </div>
        <v-divider class="my-2"></v-divider>
        <div v-if="match.diffSummary.onlyInInstance > 0" class="summary-row">
          <v-icon size="small" color="success" class="mr-1">mdi-plus</v-icon>
          <span class="summary-label">
            {{ $t('masterTableMatch.newRows') }}:
          </span>
          <span class="summary-value text-success">
            {{ match.diffSummary.onlyInInstance }}
          </span>
        </div>
        <div v-if="match.diffSummary.onlyInMaster > 0" class="summary-row">
          <v-icon size="small" color="error" class="mr-1">mdi-minus</v-icon>
          <span class="summary-label">
            {{ $t('masterTableMatch.removedRows') }}:
          </span>
          <span class="summary-value text-error">
            {{ match.diffSummary.onlyInMaster }}
          </span>
        </div>
        <div v-if="match.diffSummary.different > 0" class="summary-row">
          <v-icon size="small" color="warning" class="mr-1">mdi-pencil</v-icon>
          <span class="summary-label">
            {{ $t('masterTableMatch.modifiedRows') }}:
          </span>
          <span class="summary-value text-warning">
            {{ match.diffSummary.different }}
          </span>
        </div>
        <div v-if="match.diffSummary.identical > 0" class="summary-row">
          <v-icon size="small" color="grey" class="mr-1">mdi-equal</v-icon>
          <span class="summary-label">
            {{ $t('masterTableMatch.identicalRows') }}:
          </span>
          <span class="summary-value">{{ match.diffSummary.identical }}</span>
        </div>
      </div>

      <!-- User choice selection -->
      <div class="choice-section">
        <div class="choice-title mb-2">
          {{ $t('masterTableMatch.selectAction') }}
        </div>

        <v-radio-group
          :model-value="match.userChoice"
          @update:model-value="(value) => $emit('update:choice', match.tableKey, value)"
          hide-details
          class="choice-radio-group"
        >
          <!-- Option 1: Keep uploaded data (default) -->
          <v-radio value="keep_uploaded" color="primary">
            <template #label>
              <div class="choice-option">
                <div class="choice-option-title">
                  <v-icon size="small" class="mr-1">mdi-upload</v-icon>
                  {{ $t('masterTableMatch.option.keepUploaded.title') }}
                </div>
                <div class="choice-option-description">
                  {{ $t('masterTableMatch.option.keepUploaded.description') }}
                </div>
              </div>
            </template>
          </v-radio>

          <!-- Option 2: Use master data -->
          <v-radio value="use_master" color="secondary">
            <template #label>
              <div class="choice-option">
                <div class="choice-option-title">
                  <v-icon size="small" class="mr-1">mdi-database</v-icon>
                  {{ $t('masterTableMatch.option.useMaster.title') }}
                </div>
                <div class="choice-option-description">
                  {{ $t('masterTableMatch.option.useMaster.description') }}
                </div>
              </div>
            </template>
          </v-radio>

          <!-- Option 3: Replace master data (optional, controlled by app config) -->
          <v-radio
            v-if="showReplaceMasterOption"
            value="replace_master"
            color="warning"
            :disabled="!canReplaceMaster"
          >
            <template #label>
              <div class="choice-option">
                <div class="choice-option-title">
                  <v-icon size="small" class="mr-1">mdi-database-sync</v-icon>
                  {{ $t('masterTableMatch.option.replaceMaster.title') }}
                </div>
                <div class="choice-option-description">
                  {{ $t('masterTableMatch.option.replaceMaster.description') }}
                  <span v-if="!canReplaceMaster" class="text-error">
                    ({{ $t('masterTableMatch.option.replaceMaster.notAvailable') }})
                  </span>
                </div>
              </div>
            </template>
          </v-radio>
        </v-radio-group>
      </div>
    </v-card-text>

    <!-- Diff modal -->
    <DataComparisonModal
      v-model="showDiffModal"
      :table-name="match.tableName"
      :master-table-title="match.masterTableTitle"
      :instance-data="match.instanceData"
      :master-data="match.masterData"
      :diff-summary="match.diffSummary"
      :master-table-config="match.masterTableConfig"
      :full-instance-data="match.fullInstanceData"
      :instance-schema-columns="match.instanceSchemaColumns"
    />
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { TableMatch } from '@/composables/project-execution/useMasterTableMatch'
import DataComparisonModal from './DataComparisonModal.vue'

interface Props {
  match: TableMatch
  canReplaceMaster?: boolean
  /** When false, the "Replace master" option is hidden (e.g. when enableReplaceMasterWithUploaded is off). */
  showReplaceMasterOption?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canReplaceMaster: true,
  showReplaceMasterOption: true,
})

defineEmits<
  (e: 'update:choice', tableKey: string, choice: string) => void
>()

const showDiffModal = ref(false)
</script>

<style scoped>
.master-table-match-card {
  border-color: var(--v-warning-base, #fb8c00);
  background-color: rgba(251, 140, 0, 0.04);
}

.table-name {
  font-weight: 600;
  font-size: 1rem;
}

.diff-summary {
  background-color: rgba(0, 0, 0, 0.02);
  padding: 12px;
  border-radius: 8px;
}

.summary-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.summary-row:last-child {
  margin-bottom: 0;
}

.summary-label {
  color: var(--subtitle);
  font-size: 0.875rem;
}

.summary-value {
  font-weight: 500;
}

.choice-section {
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  padding-top: 16px;
}

.choice-title {
  font-weight: 500;
  color: var(--title);
}

.choice-radio-group :deep(.v-selection-control-group) {
  gap: 8px;
}

.choice-option {
  margin-left: 4px;
}

.choice-option-title {
  font-weight: 500;
  display: flex;
  align-items: center;
}

.choice-option-description {
  font-size: 0.8rem;
  color: var(--subtitle);
  margin-top: 2px;
}
</style>


