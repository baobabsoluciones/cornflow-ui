<template>
  <v-alert
    :type="type"
    variant="tonal"
    density="compact"
    class="mt-2 checks-error-alert"
    closable
  >
    <template #title>
      {{ title }}
    </template>
    <div class="checks-error-body">
      <p class="mb-2">{{ description }}</p>
      <v-btn
        v-if="!expanded"
        variant="text"
        size="small"
        :color="type"
        @click="$emit('update:expanded', true)"
      >
        {{ showLabel }}
      </v-btn>
      <template v-if="expanded && checksData">
        <v-btn
          variant="text"
          size="small"
          :color="type"
          class="mb-2"
          @click="$emit('update:expanded', false)"
        >
          {{ hideLabel }}
        </v-btn>
        <div
          v-for="(rows, tableName) in checksData"
          :key="tableName"
          class="checks-table-section"
        >
          <div class="checks-table-title d-flex align-center gap-1">
            <v-icon size="14" :color="isWarningTable(tableName) ? 'warning' : 'error'">
              {{ isWarningTable(tableName) ? 'mdi-alert-outline' : 'mdi-alert-circle-outline' }}
            </v-icon>
            {{ formatCheckTableName(tableName) }}
          </div>
          <v-table density="compact" class="checks-detail-table">
            <thead>
              <tr>
                <th v-for="col in Object.keys(rows[0] || {})" :key="col" scope="col">
                  {{ col }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in rows" :key="idx">
                <td v-for="col in Object.keys(rows[0] || {})" :key="col">
                  {{ row[col] }}
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </template>
    </div>
  </v-alert>
</template>

<script lang="ts">
import type { PropType } from 'vue'

export default {
  name: 'HistoricalChecksAlert',
  props: {
    /** Alert severity: 'warning' or 'error'. Also drives button color. */
    type: { type: String as PropType<'warning' | 'error'>, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    showLabel: { type: String, required: true },
    hideLabel: { type: String, required: true },
    expanded: { type: Boolean, default: false },
    checksData: { type: Object, default: null },
    isWarningTable: { type: Function, required: true },
    formatCheckTableName: { type: Function, required: true },
  },
  emits: ['update:expanded'],
}
</script>

<style scoped>
.checks-error-alert {
  font-size: 0.8125rem;
}

.checks-error-body p {
  font-size: 0.8125rem;
}

.checks-table-section {
  margin-bottom: 12px;
}

.checks-table-title {
  font-weight: 600;
  font-size: 0.8125rem;
  margin-bottom: 4px;
}

.checks-detail-table {
  font-size: 0.75rem;
  max-height: 300px;
  overflow: auto;
}

.checks-detail-table th {
  font-size: 0.75rem !important;
  white-space: nowrap;
}

.checks-detail-table td {
  font-size: 0.75rem !important;
  white-space: nowrap;
}
</style>
