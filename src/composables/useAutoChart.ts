import { computed, type ComputedRef, type Ref } from 'vue'
import { getChartColors, getCSSVariable } from '@/utils/chartColors'

/**
 * Shared chart config consumed by the Auto*Chart dashboard components.
 */
export interface AutoChartConfig {
  categories: string[]
  series: Array<{
    name: string
    data: number[]
  }>
}

/**
 * Per-chart-type differences that customise the otherwise-shared ApexCharts
 * option object. Anything left undefined is omitted from the result, matching
 * the original hand-written option objects byte-for-byte.
 */
export interface AutoChartTypeOptions {
  /** ApexCharts chart type ('area' | 'bar' | 'line'). */
  chartType: string
  /** When true the chart block is marked `stacked: false` (area only). */
  stacked?: boolean
  /** When true a disabled `zoom` block is added to the chart (area/line). */
  zoom?: boolean
  /**
   * When defined, adds the shared `stroke` (smooth, width 2.5) and a `fill`
   * gradient using this `opacityFrom` value (area/line).
   */
  gradientOpacityFrom?: number
  /** Optional `plotOptions` block (bar). */
  plotOptions?: Record<string, unknown>
  /** x-axis label `rotate` threshold (category count strictly greater than). */
  rotateThreshold: number
  /** x-axis label `rotateAlways` threshold (category count strictly greater than). */
  rotateAlwaysThreshold: number
  /** When true, the tooltip is `shared` and non-`intersect` (area/line). */
  sharedTooltip?: boolean
  /** Optional `markers` block builder, given the series count (area/line). */
  markers?: (seriesCount: number) => Record<string, unknown>
}

/**
 * Builds the reactive `chartOptions` / `series` pair shared by the
 * AutoAreaChart, AutoBarChart and AutoLineChart dashboard components.
 *
 * The returned `chartOptions` object is assembled to be identical to the
 * per-component option objects that previously lived inline, with the supplied
 * `typeOptions` accounting for the area/bar/line differences.
 */
export function useAutoChart(
  config: Ref<AutoChartConfig> | (() => AutoChartConfig),
  typeOptions: AutoChartTypeOptions,
): {
  chartOptions: ComputedRef<Record<string, unknown>>
  series: ComputedRef<AutoChartConfig['series']>
} {
  const getConfig = (): AutoChartConfig =>
    typeof config === 'function' ? config() : config.value

  const chartOptions = computed(() => {
    const cfg = getConfig()
    const seriesCount = cfg.series.length
    const colors = getChartColors(seriesCount)

    return {
      chart: {
        type: typeOptions.chartType,
        height: 350,
        ...(typeOptions.stacked !== undefined && {
          stacked: typeOptions.stacked,
        }),
        toolbar: {
          show: false,
        },
        fontFamily: 'inherit',
        ...(typeOptions.zoom && {
          zoom: {
            enabled: false,
          },
        }),
      },
      colors,
      ...(typeOptions.gradientOpacityFrom !== undefined && {
        stroke: {
          curve: 'smooth' as const,
          width: 2.5,
        },
        fill: {
          type: 'gradient',
          gradient: {
            shadeIntensity: 1,
            opacityFrom: typeOptions.gradientOpacityFrom,
            opacityTo: 0.1,
            stops: [0, 90, 100],
          },
        },
      }),
      ...(typeOptions.plotOptions !== undefined && {
        plotOptions: typeOptions.plotOptions,
      }),
      grid: {
        borderColor: 'rgba(0, 0, 0, 0.06)',
        strokeDashArray: 4,
        xaxis: {
          lines: {
            show: false,
          },
        },
        yaxis: {
          lines: {
            show: true,
          },
        },
        padding: {
          top: 0,
          right: 4,
          bottom: 0,
          left: 4,
        },
      },
      xaxis: {
        categories: cfg.categories,
        labels: {
          style: {
            colors: getCSSVariable('--subtitle'),
            fontSize: '11px',
            fontFamily: 'inherit',
          },
          rotate: cfg.categories.length > typeOptions.rotateThreshold ? -45 : 0,
          rotateAlways: cfg.categories.length > typeOptions.rotateAlwaysThreshold,
          trim: true,
          maxHeight: 80,
        },
        axisBorder: {
          show: false,
        },
        axisTicks: {
          show: false,
        },
      },
      yaxis: {
        labels: {
          style: {
            colors: getCSSVariable('--subtitle'),
            fontSize: '11px',
            fontFamily: 'inherit',
          },
          formatter: (val: number) => {
            if (Math.abs(val) >= 1_000_000) {
              return (val / 1_000_000).toFixed(1) + 'M'
            }
            if (Math.abs(val) >= 1_000) {
              return (val / 1_000).toFixed(1) + 'K'
            }
            return val.toFixed(0)
          },
        },
      },
      tooltip: {
        ...(typeOptions.sharedTooltip && {
          shared: true,
          intersect: false,
        }),
        theme: 'light',
        style: {
          fontSize: '12px',
          fontFamily: 'inherit',
        },
        y: {
          formatter: (val: number) => {
            return new Intl.NumberFormat('en-US', {
              maximumFractionDigits: 2,
            }).format(val)
          },
        },
      },
      legend: {
        show: seriesCount > 1,
        position: 'top',
        horizontalAlign: 'right',
        fontSize: '12px',
        fontFamily: 'inherit',
        labels: {
          colors: getCSSVariable('--title'),
        },
        markers: {
          width: 8,
          height: 8,
          radius: 4,
        },
      },
      ...(typeOptions.markers !== undefined && {
        markers: typeOptions.markers(seriesCount),
      }),
      dataLabels: {
        enabled: false,
      },
    }
  })

  const series = computed(() => getConfig().series)

  return { chartOptions, series }
}
