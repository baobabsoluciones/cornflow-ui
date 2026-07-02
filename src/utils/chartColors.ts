/**
 * Utility functions for getting chart colors from CSS variables.
 * This is the single source of truth for all chart color logic.
 * All chart components should import from here instead of
 * duplicating CSS variable access.
 */

/** Default fallback colors aligned with the chart palette in variables.css */
const CHART_COLOR_FALLBACKS: Record<string, string> = {
  '--chart-color-1': '#326786',
  '--chart-color-2': '#1e3f4f',
  '--chart-color-3': '#3ba780',
  '--chart-color-4': '#4e7f9c',
  '--chart-color-5': '#7fb3cc',
  '--chart-color-6': '#2d6a5a',
  '--chart-color-7': '#5a9bb5',
  '--chart-color-8': '#1a5276',
  '--chart-color-9': '#48a999',
  '--chart-color-10': '#85c1d4',
}

const THEME_FALLBACKS: Record<string, string> = {
  '--primary': '#326786',
  '--primary-variant': '#1e3f4f',
  '--primary-light': '#7fb3cc',
  '--secondary': '#ffb458',
  '--success': '#3ba780',
  '--warning': '#ffb458',
  '--danger': '#f44336',
  '--title': '#404040',
  '--subtitle': '#6e6e6e',
}

/**
 * Get CSS variable value from the document.
 * Falls back to hardcoded values when running in SSR
 * or when the variable is not defined.
 */
export function getCSSVariable(variableName: string): string {
  if (globalThis.window === undefined) {
    return (
      CHART_COLOR_FALLBACKS[variableName] ||
      THEME_FALLBACKS[variableName] ||
      '#326786'
    )
  }

  let value = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim()

  if (!value) {
    value = getComputedStyle(document.body)
      .getPropertyValue(variableName)
      .trim()
  }

  if (!value) {
    return (
      CHART_COLOR_FALLBACKS[variableName] ||
      THEME_FALLBACKS[variableName] ||
      '#326786'
    )
  }

  return value
}

/**
 * Get the primary theme color for single-series charts.
 */
export function getPrimaryColor(): string {
  return getCSSVariable('--primary')
}

/**
 * Get a chart palette color by its 1-based index.
 * Wraps around if index exceeds the palette size (10).
 */
export function getChartColor(index: number): string {
  const colorIndex = ((index - 1) % 10) + 1
  return getCSSVariable(`--chart-color-${colorIndex}`)
}

/**
 * Get an array of chart palette colors for multiple series.
 * Uses the --chart-color-N CSS variables defined in variables.css.
 */
export function getChartColors(count: number): string[] {
  const colors: string[] = []
  for (let i = 0; i < count; i++) {
    colors.push(getChartColor(i + 1))
  }
  return colors
}

/**
 * Convert a hex color to rgba with the given opacity.
 * Useful for creating gradient fills and translucent backgrounds.
 */
export function getColorWithOpacity(color: string, opacity: number): string {
  if (color.startsWith('#')) {
    const hex = color.replace('#', '')
    const r = Number.parseInt(hex.slice(0, 2), 16)
    const g = Number.parseInt(hex.slice(2, 4), 16)
    const b = Number.parseInt(hex.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }
  return color
}
