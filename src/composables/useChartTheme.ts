/**
 * The look of an ApexCharts chart taken from the design tokens: font, text and grid colours,
 * axes, legend and tooltip, so every dashboard's charts read as one family.
 *
 * `baseOptions` is a starting point: a chart spreads it and sets its own type, series colours,
 * axes formatters and annotations on top. `palette` has the token colours, for the series.
 *
 *   const { palette, baseOptions } = useChartTheme(root)
 *   const options = computed(() => ({ ...baseOptions.value, colors: [palette.value.series[0]] }))
 *
 * The tokens are read from `body` when the composable is called, and again from `root` when the
 * component mounts, so a screen that overrides them on its own element gets its colours.
 */
import { computed, onMounted, ref, type Ref } from 'vue'
import type ApexCharts from 'apexcharts'
import type { ApexOptions } from 'apexcharts'
import { readCssToken } from '@cornflow-ui/core/plugins/vuetify'

export interface ChartPalette {
  /** The series colours, `--chart-color-1` onwards. */
  series: string[]
  primary: string
  success: string
  warning: string
  danger: string
  text: string
  textMuted: string
  grid: string
  /** A soft fill for bands and backgrounds. */
  muted: string
  surface: string
  font: string
}

const SERIES_TOKENS = 6

const FALLBACK: ChartPalette = {
  series: ['#326786', '#1e3f4f', '#3ba780', '#4e7f9c', '#7fb3cc', '#2d6a5a'],
  primary: '#1b5e8a',
  success: '#3b7b5e',
  warning: '#dea727',
  danger: '#b43c31',
  text: '#404040',
  textMuted: '#6e6e6e',
  grid: '#ededed',
  muted: '#f5f6f7',
  surface: '#ffffff',
  font: 'Roboto, system-ui, sans-serif',
}

/** The palette as the tokens set it on `element`, with the defaults for what is not set. */
export function readChartPalette(element: Element = document.body): ChartPalette {
  const read = (name: string, fallback: string) => readCssToken(name, element) || fallback
  return {
    series: FALLBACK.series.map((fallback, index) =>
      index < SERIES_TOKENS ? read(`--chart-color-${index + 1}`, fallback) : fallback,
    ),
    primary: read('--color-primary', FALLBACK.primary),
    success: read('--color-success', FALLBACK.success),
    warning: read('--color-warning', FALLBACK.warning),
    danger: read('--color-danger-strong', FALLBACK.danger),
    text: read('--color-text', FALLBACK.text),
    textMuted: read('--color-text-muted', FALLBACK.textMuted),
    grid: read('--color-divider', FALLBACK.grid),
    muted: read('--color-surface-muted', FALLBACK.muted),
    surface: read('--color-surface', FALLBACK.surface),
    font: getComputedStyle(element).getPropertyValue('--font-sans').trim() || FALLBACK.font,
  }
}

/** Options every chart starts from, in the colours of `palette`. */
export function chartBaseOptions(palette: ChartPalette): ApexOptions {
  const axisLabels = { colors: palette.textMuted, fontSize: '11px', fontFamily: palette.font }
  return {
    chart: {
      fontFamily: palette.font,
      foreColor: palette.textMuted,
      background: 'transparent',
      parentHeightOffset: 0,
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: true, speed: 250, animateGradually: { enabled: false } },
    },
    dataLabels: { enabled: false },
    fill: { opacity: 1 },
    grid: {
      borderColor: palette.grid,
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      padding: { top: 0, right: 8, bottom: 0, left: 8 },
    },
    xaxis: {
      axisBorder: { show: true, color: palette.grid },
      axisTicks: { show: false },
      crosshairs: { show: false },
      tooltip: { enabled: false },
      labels: { rotate: 0, hideOverlappingLabels: true, trim: false, style: axisLabels },
    },
    yaxis: { labels: { style: axisLabels } },
    legend: {
      position: 'top',
      horizontalAlign: 'left',
      fontSize: '12px',
      fontFamily: palette.font,
      labels: { colors: palette.text },
      markers: { size: 5, strokeWidth: 0, shape: 'circle' },
      itemMargin: { horizontal: 10, vertical: 0 },
    },
    tooltip: { theme: 'light', style: { fontSize: '12px', fontFamily: palette.font } },
    states: { active: { filter: { type: 'none' } } },
  }
}

/**
 * ApexCharts draws the x-axis annotations (bands, ranges) over the series. Given as the chart's
 * `mounted` and `updated` events, this puts them behind, so a band shades the plot without
 * covering the bars and lines.
 */
export function annotationsBehindSeries(chart: ApexCharts): void {
  const { el } = chart as unknown as { el: Element }
  const annotations = el.querySelector('.apexcharts-xaxis-annotations')
  annotations?.parentNode?.insertBefore(annotations, annotations.parentNode.firstChild)
}

export function useChartTheme(root?: Ref<HTMLElement | null>) {
  const palette = ref<ChartPalette>(globalThis.document ? readChartPalette() : FALLBACK)

  // The screen's own element may override the tokens of `body`; a new palette redraws the charts.
  onMounted(() => {
    if (!root?.value) return
    const own = readChartPalette(root.value)
    if (JSON.stringify(own) !== JSON.stringify(palette.value)) palette.value = own
  })

  const baseOptions = computed(() => chartBaseOptions(palette.value))

  return { palette, baseOptions }
}
