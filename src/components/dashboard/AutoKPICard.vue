<template>
  <div class="kpi-card">
    <div class="kpi-content">
      <div class="kpi-top-section">
        <div class="kpi-header">
          <div
            v-if="displayIcon"
            class="kpi-icon-wrapper"
            :class="iconColorClass"
          >
            <v-icon :icon="displayIcon" class="kpi-icon" size="18" />
          </div>
          <div class="kpi-title">{{ config.label }}</div>
        </div>
      </div>
      <div class="kpi-value">{{ formattedValue }}</div>
      <div
        v-if="config.change !== undefined || config.period"
        class="kpi-bottom-section"
      >
        <div
          v-if="config.change !== undefined"
          class="kpi-change"
          :class="getChangeClass(config.change)"
        >
          <span>{{ formatChange(config.change, config.changeValue) }}</span>
        </div>
        <div
          v-if="config.change !== undefined && config.period"
          class="kpi-separator"
        >
          &middot;
        </div>
        <div v-if="config.period" class="kpi-period">{{ config.period }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import '@cornflow-ui/core/assets/styles/dashboard.css'

interface Props {
  config: {
    value: number
    label: string
    format?: 'number' | 'currency' | 'percentage'
    change?: number // Percentage change
    changeValue?: number // Absolute value change (for currency format)
    period?: string // Time period (e.g., "Last 30 Days")
    icon?: string
  }
}

const props = defineProps<Props>()

// Determine icon to display based on KPI type
const displayIcon = computed(() => {
  const labelLower = props.config.label.toLowerCase()

  // Priority order: check for most specific types first

  // Check for "maximum" or "max" FIRST (before "total")
  if (
    labelLower.includes('maxima') ||
    labelLower.includes('maximum') ||
    (labelLower.includes('max') && !labelLower.includes('min'))
  ) {
    return 'mdi-trending-up'
  }

  // Check for "minimum" or "min" FIRST (before "total")
  if (
    labelLower.includes('minima') ||
    labelLower.includes('minimum') ||
    (labelLower.includes('min') && !labelLower.includes('max'))
  ) {
    return 'mdi-trending-down'
  }

  // Check for "average" or "promedio"
  if (
    labelLower.startsWith('promedio ') ||
    labelLower.startsWith('average ') ||
    labelLower.endsWith(' promedio') ||
    labelLower.endsWith(' average') ||
    labelLower.includes(' promedio ') ||
    labelLower.includes(' average ') ||
    labelLower.includes('avg ')
  ) {
    return 'mdi-chart-line-variant'
  }

  // Check for "total" or "sum"
  if (
    labelLower.endsWith(' total') ||
    labelLower.startsWith('total ') ||
    labelLower.includes(' total ') ||
    labelLower.includes('sum') ||
    labelLower.includes('suma')
  ) {
    return 'mdi-calculator'
  }

  // If icon is provided in config, use it as fallback
  if (props.config.icon) {
    return props.config.icon
  }

  // Default icon
  return 'mdi-chart-box'
})

// Get icon color class based on KPI type
const iconColorClass = computed(() => {
  const labelLower = props.config.label.toLowerCase()

  if (
    labelLower.includes('maxima') ||
    labelLower.includes('maximum') ||
    (labelLower.includes('max') && !labelLower.includes('min'))
  ) {
    return 'kpi-icon--success'
  }

  if (
    labelLower.includes('minima') ||
    labelLower.includes('minimum') ||
    (labelLower.includes('min') && !labelLower.includes('max'))
  ) {
    return 'kpi-icon--warning'
  }

  if (
    labelLower.includes('promedio') ||
    labelLower.includes('average') ||
    labelLower.includes('avg')
  ) {
    return 'kpi-icon--accent'
  }

  if (
    labelLower.includes('total') ||
    labelLower.includes('sum') ||
    labelLower.includes('suma')
  ) {
    return 'kpi-icon--primary'
  }

  return 'kpi-icon--primary'
})

const formattedValue = computed(() => {
  const { value, format = 'number' } = props.config

  if (format === 'currency') {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  if (format === 'percentage') {
    return `${value.toFixed(2)}%`
  }

  // Format number with thousand separators
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)
})

const formatChange = (
  change: number | undefined,
  changeValue: number | undefined,
): string => {
  if (change === undefined) return ''
  const sign = change > 0 ? '+' : ''
  const percentage = `${sign}${change.toFixed(1)}%`

  if (changeValue !== undefined && props.config.format === 'currency') {
    const formattedValue = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(changeValue))
    return `${percentage} (${formattedValue})`
  }

  return percentage
}

const getChangeClass = (change: number | undefined): string => {
  if (change === undefined) return ''
  return change > 0 ? 'positive' : 'negative'
}
</script>

<style scoped>
.kpi-top-section {
  margin-bottom: 12px;
}

.kpi-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.kpi-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
  transition: background-color 0.2s ease;
}

/* Icon color variants using CSS variables */
.kpi-icon--primary {
  background-color: var(--primary-light-variant, #e6f1f7);
}

.kpi-icon--primary .kpi-icon {
  color: var(--primary, #326786);
}

.kpi-icon--accent {
  background-color: var(--primary-light-variant, #e6f1f7);
}

.kpi-icon--accent .kpi-icon {
  color: var(--accent, #4e7f9c);
}

.kpi-icon--success {
  background-color: rgba(59, 167, 128, 0.12);
}

.kpi-icon--success .kpi-icon {
  color: var(--success, #3ba780);
}

.kpi-icon--warning {
  background-color: rgba(255, 180, 88, 0.15);
}

.kpi-icon--warning .kpi-icon {
  color: var(--warning, #ffb458);
}

.kpi-title {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--subtitle, #6e6e6e);
  line-height: 1.4;
  letter-spacing: 0.01em;
  flex: 1;
}

.kpi-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--title, #404040);
  line-height: 1.2;
  margin-bottom: 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif;
  letter-spacing: -0.02em;
}

.kpi-bottom-section {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  font-size: 0.8125rem;
  line-height: 1.4;
}

.kpi-change {
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  letter-spacing: 0.01em;
}

.kpi-separator {
  color: var(--subtitle, #6e6e6e);
  font-size: 0.75rem;
  margin: 0 2px;
}

.kpi-period {
  color: var(--subtitle, #6e6e6e);
  font-size: 0.8125rem;
  font-weight: 400;
}

.kpi-change.positive {
  color: var(--success, #3ba780);
}

.kpi-change.negative {
  color: var(--danger, #f44336);
}
</style>
