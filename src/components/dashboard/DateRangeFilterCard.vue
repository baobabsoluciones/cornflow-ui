<template>
  <div class="date-range-filter-card">
    <v-row align="center" dense>
      <v-col cols="12" sm="6" md="2">
        <v-text-field
          :model-value="dateFrom"
          :label="t(i18nKeyPrefix + '.from')"
          type="date"
          density="compact"
          variant="outlined"
          hide-details
          @update:model-value="$emit('update:dateFrom', $event)"
        />
      </v-col>
      <v-col cols="12" sm="6" md="2">
        <v-text-field
          :model-value="dateTo"
          :label="t(i18nKeyPrefix + '.to')"
          type="date"
          density="compact"
          variant="outlined"
          hide-details
          @update:model-value="$emit('update:dateTo', $event)"
        />
      </v-col>
      <slot name="extra-filters" />
      <v-col cols="auto">
        <v-btn
          color="primary"
          variant="flat"
          size="small"
          prepend-icon="mdi-magnify"
          :loading="loading"
          @click="$emit('apply')"
        >
          {{ t(i18nKeyPrefix + '.apply') }}
        </v-btn>
      </v-col>

      <v-spacer />

      <v-col cols="auto">
        <v-btn
          variant="text"
          color="primary"
          size="small"
          prepend-icon="mdi-filter-remove"
          @click="$emit('reset')"
        >
          {{ t(i18nKeyPrefix + '.reset') }}
        </v-btn>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    dateFrom: string
    dateTo: string
    loading?: boolean
    /** i18n key prefix for labels: from, to, apply, reset (e.g. 'trendsDashboard.filters' or 'ateneaDashboard.filters') */
    i18nKeyPrefix?: string
  }>(),
  { i18nKeyPrefix: 'trendsDashboard.filters' }
)

defineEmits<{
  (e: 'update:dateFrom', value: string): void
  (e: 'update:dateTo', value: string): void
  (e: 'apply'): void
  (e: 'reset'): void
}>()

const { t } = useI18n()
</script>

<style scoped>
.date-range-filter-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  padding: 16px 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
</style>
