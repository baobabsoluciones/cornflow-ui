<template>
  <div v-if="enabled" class="historical-toggle">
    <div class="toggle-row">
      <v-btn-toggle
        v-model="mode"
        mandatory
        density="compact"
        color="primary"
        class="mode-toggle"
      >
        <v-btn value="execution" size="small">
          <v-icon start size="small">mdi-play-circle-outline</v-icon>
          {{ $t('historical.toggleExecution') }}
        </v-btn>
        <v-btn value="historical" size="small">
          <v-icon start size="small">mdi-history</v-icon>
          {{ $t('historical.toggleHistorical') }}
        </v-btn>
      </v-btn-toggle>

      <template v-if="mode === 'historical'">
        <div class="date-controls">
          <v-text-field
            v-model="dateFrom"
            type="date"
            :label="$t('historical.dateFrom')"
            density="compact"
            variant="outlined"
            hide-details
            class="date-field"
            :disabled="isLoading"
          />
          <v-text-field
            v-model="dateTo"
            type="date"
            :label="$t('historical.dateTo')"
            density="compact"
            variant="outlined"
            hide-details
            class="date-field"
            :disabled="isLoading"
          />
          <v-btn
            color="primary"
            size="small"
            :loading="isLoading"
            :disabled="!canLoad"
            @click="loadHistorical"
          >
            {{ $t('historical.load') }}
          </v-btn>
          <v-btn
            v-if="
              historical.execution || historical.bannerMode === 'checks_error' || historical.bannerMode === 'checks_warning'
            "
            variant="text"
            size="small"
            @click="clearHistorical"
          >
            {{ $t('historical.clear') }}
          </v-btn>
        </div>
      </template>
    </div>

    <v-progress-linear
      v-if="isLoading"
      indeterminate
      color="primary"
      class="mt-1"
      height="3"
    />
    <div v-if="statusMessage" class="status-message" :class="statusClass">
      {{ statusMessage }}
    </div>

    <!-- Historical data active indicator (KPIs loaded successfully) -->
    <v-chip
      v-if="historical.bannerMode === 'done' || historical.bannerMode === 'checks_warning'"
      color="primary"
      variant="tonal"
      size="small"
      class="mt-2 historical-active-chip"
      prepend-icon="mdi-history"
    >
      {{ $t('historical.viewingHistoricalData') }}
    </v-chip>

    <!-- Checks warning alert (KPIs present but some check tables have data) -->
    <HistoricalChecksAlert
      v-if="historical.bannerMode === 'checks_warning'"
      type="warning"
      :title="$t('historical.checksWarningTitle')"
      :description="$t('historical.checksWarningDescription')"
      :show-label="$t('historical.showWarnings')"
      :hide-label="$t('historical.hideWarnings')"
      :expanded="checksExpanded"
      :checks-data="historical.checksData"
      :is-warning-table="isWarningTable"
      :format-check-table-name="formatCheckTableName"
      @update:expanded="checksExpanded = $event"
    />

    <!-- Checks error alert (KPIs could not be calculated) -->
    <HistoricalChecksAlert
      v-if="historical.bannerMode === 'checks_error'"
      type="error"
      :title="$t('historical.checksErrorTitle')"
      :description="$t('historical.checksErrorDescription')"
      :show-label="$t('historical.showErrors')"
      :hide-label="$t('historical.hideErrors')"
      :expanded="checksExpanded"
      :checks-data="historical.checksData"
      :is-warning-table="isWarningTable"
      :format-check-table-name="formatCheckTableName"
      @update:expanded="checksExpanded = $event"
    />
  </div>
</template>

<script lang="ts">
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import HistoricalChecksAlert from '@cornflow-ui/core/components/HistoricalChecksAlert.vue'

export default {
  name: 'HistoricalDataToggle',
  components: { HistoricalChecksAlert },
  emits: ['update:isHistorical'],
  data() {
    return {
      generalStore: useGeneralStore(),
      mode: 'execution',
      dateFrom: '',
      dateTo: '',
      checksExpanded: false,
    }
  },
  computed: {
    enabled() {
      return (
        this.generalStore.appConfig?.parameters?.enableHistoricalKpis === true
      )
    },
    historical() {
      return this.generalStore.historicalState
    },
    isLoading() {
      const m = this.historical.bannerMode
      return m === 'creating' || m === 'data_check' || m === 'polling'
    },
    canLoad() {
      return this.dateFrom !== '' && this.dateTo !== '' && !this.isLoading
    },
    statusMessage() {
      switch (this.historical.bannerMode) {
        case 'creating':
          return this.$t('historical.creating')
        case 'data_check':
          return this.$t('historical.checking')
        case 'polling':
          return this.$t('historical.polling')
        case 'error':
          return this.historical.errorMessage || this.$t('historical.error')
        default:
          return null
      }
    },
    statusClass() {
      const m = this.historical.bannerMode
      return m === 'error' ? 'error-text' : 'info-text'
    },
  },
  watch: {
    mode(newMode) {
      this.$emit('update:isHistorical', newMode === 'historical')
    },
    'historical.bannerMode'(newMode) {
      if ((newMode === 'done' || newMode === 'checks_warning') && this.historical.execution) {
        this.mode = 'historical'
        this.dateFrom = this.historical.dateRange.from
        this.dateTo = this.historical.dateRange.to
        if (newMode === 'checks_warning') {
          this.checksExpanded = false
        }
      } else if (newMode === 'checks_error') {
        this.mode = 'historical'
        this.dateFrom = this.historical.dateRange.from
        this.dateTo = this.historical.dateRange.to
        this.checksExpanded = false
      } else if (newMode === 'idle') {
        this.mode = 'execution'
        this.dateFrom = ''
        this.dateTo = ''
        this.checksExpanded = false
      }
    },
  },
  created() {
    this.syncFromStore()
  },
  activated() {
    this.syncFromStore()
  },
  methods: {
    syncFromStore() {
      const m = this.historical.bannerMode
      if ((m === 'done' || m === 'checks_warning') && this.historical.execution) {
        this.mode = 'historical'
        this.dateFrom = this.historical.dateRange.from
        this.dateTo = this.historical.dateRange.to
      } else if (m === 'idle') {
        this.mode = 'execution'
      }
    },
    async loadHistorical() {
      await this.generalStore.runHistoricalKpiFlow(this.dateFrom, this.dateTo)
    },
    clearHistorical() {
      this.generalStore.clearHistoricalExecution()
      this.mode = 'execution'
      this.dateFrom = ''
      this.dateTo = ''
      this.checksExpanded = false
    },
    formatCheckTableName(key) {
      return key.replaceAll('_', ' ').replaceAll(/\b\w/g, (c) => c.toUpperCase())
    },
    isWarningTable(tableName) {
      const keys = this.historical.checksWarningKeys
      return Array.isArray(keys) && keys.includes(tableName)
    },
  },
}
</script>

<style scoped>
.historical-toggle {
  margin-top: 14px;
  margin-bottom: 4px;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.mode-toggle {
  flex-shrink: 0;
}

.date-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.date-field {
  max-width: 180px;
  min-width: 140px;
}

.status-message {
  font-size: 0.8125rem;
  margin-top: 4px;
  padding-left: 4px;
}

.info-text {
  color: rgba(var(--v-theme-info), 1);
}

.error-text {
  color: rgba(var(--v-theme-error), 1);
}

.historical-active-chip {
  font-size: 0.75rem;
}
</style>
