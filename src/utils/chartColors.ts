/**
 * Utility functions for getting chart colors from CSS variables
 */

/**
 * Get CSS variable value as hex color
 */
export function getCSSVariable(variableName: string): string {
  if (typeof window === 'undefined') {
    // Fallback values if running on server
    const fallbacks: Record<string, string> = {
      '--primary': '#0984c6',
      '--primary-variant': '#065a8e',
      '--primary-light': '#bfddf3',
      '--secondary': '#014b5b',
      '--success': '#3ba780',
      '--warning': '#dea727',
      '--danger': '#f44336',
    }
    return fallbacks[variableName] || '#0984c6'
  }

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim()

  return value || '#0984c6'
}

/**
 * Get primary color for charts
 */
export function getPrimaryColor(): string {
  return getCSSVariable('--primary')
}

/**
 * Get array of colors for charts based on CSS variables
 */
export function getChartColors(count: number): string[] {
  const baseColors = [
    getCSSVariable('--primary'),
    getCSSVariable('--primary-variant'),
    getCSSVariable('--secondary'),
    getCSSVariable('--success'),
    getCSSVariable('--warning'),
  ]

  const colors: string[] = []
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length])
  }
  return colors
}

/**
 * Get color with opacity for gradients
 */
export function getColorWithOpacity(color: string, opacity: number): string {
  // Convert hex to rgba
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }
  return color
}

