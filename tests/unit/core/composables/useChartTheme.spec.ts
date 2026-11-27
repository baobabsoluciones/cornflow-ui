import { describe, expect, test } from 'vitest'
import {
  annotationsBehindSeries,
  chartBaseOptions,
  readChartPalette,
} from '@cornflow-ui/core/composables/useChartTheme'

describe('useChartTheme', () => {
  test('reads the palette from the tokens, keeping the defaults for what is not set', () => {
    const element = document.createElement('div')
    element.style.setProperty('--chart-color-1', '#112233')
    element.style.setProperty('--color-divider', '#abcdef')
    document.body.appendChild(element)

    const palette = readChartPalette(element)
    expect(palette.series[0]).toBe('#112233')
    expect(palette.series).toHaveLength(6)
    expect(palette.grid).toBe('#abcdef')
    expect(palette.danger).toBe('#b43c31')
    element.remove()
  })

  test('starts every chart quiet: no toolbar, no zoom, no data labels, flat x labels', () => {
    const options = chartBaseOptions(readChartPalette())
    expect(options.chart?.toolbar?.show).toBe(false)
    expect(options.chart?.zoom?.enabled).toBe(false)
    expect(options.dataLabels?.enabled).toBe(false)
    expect(options.xaxis?.labels?.rotate).toBe(0)
    expect(options.legend?.horizontalAlign).toBe('left')
  })

  test('puts the x-axis annotations behind the series', () => {
    const el = document.createElement('div')
    el.innerHTML =
      '<svg><g class="plot"><g class="apexcharts-series"></g><g class="apexcharts-xaxis-annotations"></g></g></svg>'
    annotationsBehindSeries({ el } as never)
    const plot = el.querySelector('.plot')!
    expect(plot.firstElementChild?.classList.contains('apexcharts-xaxis-annotations')).toBe(true)
  })
})
