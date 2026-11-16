<!--
  A made-to-measure dashboard of the demo app, as an application would build one: the screenshots
  of the custom dashboards and of the historical data show it. Only the documentation screenshots
  register it (see docsOverrides.ts, `demoDashboard`).
-->
<template>
  <div class="view-container demo-dashboard">
    <CoreTitleView icon="mdi-view-dashboard" :title="$t('docsDemo.dashboard')" description="Capacidad usada por planta y semana">
      <template #actions>
        <ExecutionSummary />
      </template>
    </CoreTitleView>

    <HistoricalDataToggle />

    <div class="demo-dashboard__kpis">
      <div v-for="kpi in kpis" :key="kpi.label" class="demo-dashboard__kpi">
        <span class="demo-dashboard__kpi-label">{{ kpi.label }}</span>
        <span class="demo-dashboard__kpi-value">{{ kpi.value }}</span>
      </div>
    </div>

    <div class="demo-dashboard__card">
      <h3 class="demo-dashboard__card-title">Utilización por planta (%)</h3>
      <div v-for="row in usage" :key="`${row.semana}-${row.id_planta}`" class="demo-dashboard__bar-row">
        <span class="demo-dashboard__bar-label">S{{ row.semana }} · {{ row.id_planta }}</span>
        <span class="demo-dashboard__bar">
          <span class="demo-dashboard__bar-fill" :style="{ width: `${Math.min(row.utilizacion, 100)}%` }" />
        </span>
        <span class="demo-dashboard__bar-value">{{ row.utilizacion.toLocaleString('es-ES') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CoreTitleView from '@cornflow-ui/core/components/core/CoreTitleView.vue'
import ExecutionSummary from '@cornflow-ui/core/components/ExecutionSummary.vue'
import HistoricalDataToggle from '@cornflow-ui/core/components/HistoricalDataToggle.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

const store = useGeneralStore()

const data = computed<Record<string, any[]>>(
  () => (store.selectedExecution as any)?.experiment?.solution?.data ?? {},
)

const usage = computed(() => (data.value.uso_capacidad ?? []).filter((row) => row.semana <= 45))

const kpis = computed(() => {
  const plan = data.value.plan_produccion ?? []
  const units = plan.reduce((sum, row) => sum + Number(row.unidades || 0), 0)
  const hours = plan.reduce((sum, row) => sum + Number(row.horas || 0), 0)
  const rows = data.value.uso_capacidad ?? []
  const average = rows.length ? rows.reduce((s, r) => s + Number(r.utilizacion || 0), 0) / rows.length : 0
  return [
    { label: 'Unidades planificadas', value: units.toLocaleString('es-ES') },
    { label: 'Horas de línea', value: Math.round(hours).toLocaleString('es-ES') },
    { label: 'Utilización media', value: `${average.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %` },
  ]
})
</script>

<style scoped>
.demo-dashboard__kpis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin: 16px 0;
}
.demo-dashboard__kpi,
.demo-dashboard__card {
  background: var(--color-surface, #fff);
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.06));
}
.demo-dashboard__kpi {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.demo-dashboard__kpi-label {
  color: var(--color-text-muted, #666);
  font-size: 13px;
}
.demo-dashboard__kpi-value {
  font-size: 26px;
  font-weight: 600;
  color: var(--color-primary, #1d5f8a);
}
.demo-dashboard__card-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
}
.demo-dashboard__bar-row {
  display: grid;
  grid-template-columns: 90px 1fr 60px;
  align-items: center;
  gap: 12px;
  margin: 6px 0;
  font-size: 13px;
}
.demo-dashboard__bar {
  height: 14px;
  border-radius: 7px;
  background: var(--color-primary-soft, #e3edf4);
  overflow: hidden;
}
.demo-dashboard__bar-fill {
  display: block;
  height: 100%;
  background: var(--color-primary, #1d5f8a);
}
.demo-dashboard__bar-value {
  text-align: right;
}
</style>
