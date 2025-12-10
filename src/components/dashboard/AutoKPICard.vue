<template>
  <div class="kpi-card">
    <div class="kpi-content">
      <div class="kpi-top-section">
        <div class="kpi-header">
          <div
            v-if="displayIcon"
            class="kpi-icon-wrapper"
            :style="{ backgroundColor: iconBackgroundColor }"
          >
            <v-icon :icon="displayIcon" class="kpi-icon" size="20" />
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
          •
        </div>
        <div v-if="config.period" class="kpi-period">{{ config.period }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import '@/assets/styles/dashboard.css'

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
  
  // Check for "máximo" or "maximum" or "max" FIRST (before "total")
  // Examples: "Produccion Maxima total", "Maximum Production"
  if (
    labelLower.includes('maxima') ||
    labelLower.includes('maximum') ||
    (labelLower.includes('max') && !labelLower.includes('min'))
  ) {
    return 'mdi-trending-up' // Trending up for maximum
  }
  
  // Check for "mínimo" or "minimum" or "min" FIRST (before "total")
  // Examples: "Produccion Minima total", "Minimum Production"
  if (
    labelLower.includes('minima') ||
    labelLower.includes('minimum') ||
    (labelLower.includes('min') && !labelLower.includes('max'))
  ) {
    return 'mdi-trending-down' // Trending down for minimum
  }
  
  // Check for "promedio" or "average" - must be at the beginning or end
  // Examples: "Promedio Prima Euro M3", "Prima Euro M3 promedio", "Average Prima"
  if (
    labelLower.startsWith('promedio ') ||
    labelLower.startsWith('average ') ||
    labelLower.endsWith(' promedio') ||
    labelLower.endsWith(' average') ||
    labelLower.includes(' promedio ') ||
    labelLower.includes(' average ') ||
    labelLower.includes('avg ')
  ) {
    return 'mdi-chart-line-variant' // Line chart variant for averages
  }
  
  // Check for "total" or "sum" - must be at the end of the label or standalone
  // Examples: "Prima Euro M3 total", "Total Prima Euro M3"
  // This comes last because "total" can appear in other labels
  if (
    labelLower.endsWith(' total') ||
    labelLower.startsWith('total ') ||
    labelLower.includes(' total ') ||
    labelLower.includes('sum') ||
    labelLower.includes('suma')
  ) {
    return 'mdi-calculator' // Sum/calculator icon for totals
  }
  
  // If icon is provided in config (from column type), use it as fallback
  if (props.config.icon) {
    return props.config.icon
  }
  
  // Default icon
  return 'mdi-chart-box'
})

// Get icon background color based on icon type
const iconBackgroundColor = computed(() => {
  const icon = displayIcon.value
  const labelLower = props.config.label.toLowerCase()
  
  // Total/Sum icons - blue
  if (
    icon.includes('calculator') ||
    labelLower.includes('total') ||
    labelLower.includes('sum')
  ) {
    return 'rgba(9, 132, 198, 0.15)' // Primary blue with opacity
  }
  
  // Average icons - teal
  if (
    icon.includes('chart-line') ||
    labelLower.includes('promedio') ||
    labelLower.includes('average')
  ) {
    return 'rgba(1, 75, 91, 0.15)' // Secondary teal with opacity
  }
  
  // Maximum icons - green
  if (
    icon.includes('trending-up') ||
    labelLower.includes('maxima') ||
    labelLower.includes('maximum')
  ) {
    return 'rgba(59, 167, 128, 0.15)' // Success green with opacity
  }
  
  // Minimum icons - orange/warning
  if (
    icon.includes('trending-down') ||
    labelLower.includes('minima') ||
    labelLower.includes('minimum')
  ) {
    return 'rgba(222, 167, 39, 0.15)' // Warning orange with opacity
  }
  
  // Financial icons - blue
  if (icon.includes('wallet') || icon.includes('currency') || icon.includes('cash')) {
    return 'rgba(9, 132, 198, 0.15)' // Primary blue with opacity
  }
  
  // Default - light blue
  return 'rgba(9, 132, 198, 0.15)'
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
    return `${percentage}(${formattedValue})`
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
  margin-bottom: 16px;
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

.kpi-icon {
  color: var(--primary);
}

.kpi-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--subtitle);
  line-height: 1.5;
  letter-spacing: 0.01em;
  flex: 1;
}

.kpi-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--title);
  line-height: 1.2;
  margin-bottom: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  letter-spacing: -0.02em;
}

.kpi-bottom-section {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  font-size: 0.875rem;
  line-height: 1.4;
}

.kpi-change {
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  letter-spacing: 0.01em;
}

.kpi-separator {
  color: #9ca3af;
  font-size: 0.75rem;
  margin: 0 2px;
}

.kpi-period {
  color: var(--subtitle);
  font-size: 0.875rem;
  font-weight: 400;
}

.kpi-change.positive {
  color: var(--success);
}

.kpi-change.negative {
  color: var(--danger);
}
</style>
