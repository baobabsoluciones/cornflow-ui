import { computed } from 'vue'

export interface ButtonStylesProps {
  variant: 'filled' | 'outlined' | 'text' | 'icon'
  color: string
  backgroundColor?: string | null
  textColor?: string | null
}

// CSS color variable mapping
const COLOR_MAP: Record<string, string> = {
  primary: 'var(--primary)',
  warning: 'var(--warning)',
}

/**
 * Resolve color from prop to CSS variable or direct value
 */
function resolveColor(color: string): string {
  return COLOR_MAP[color] ?? color
}

/**
 * Get text color based on props
 */
function getTextColor(textColor: string | null | undefined, color: string): string {
  return textColor ?? resolveColor(color)
}

/**
 * Get styles for filled variant
 */
function getFilledStyles(props: ButtonStylesProps): Record<string, string> {
  return {
    backgroundColor: props.backgroundColor ?? resolveColor(props.color),
    color: props.textColor ?? 'white',
    border: 'none',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  }
}

/**
 * Get styles for outlined variant
 */
function getOutlinedStyles(props: ButtonStylesProps): Record<string, string> {
  const resolvedColor = resolveColor(props.color)
  const textColor = props.textColor ?? resolvedColor
  const borderColor = props.textColor ? props.color : resolvedColor

  return {
    backgroundColor: props.backgroundColor ?? 'transparent',
    color: textColor,
    borderColor: borderColor,
    border: `2px solid ${borderColor}`,
    boxShadow: 'none',
  }
}

/**
 * Get styles for text/icon variants
 */
function getTextIconStyles(props: ButtonStylesProps): Record<string, string> {
  return {
    backgroundColor: 'transparent',
    color: getTextColor(props.textColor, props.color),
    border: 'none',
    boxShadow: 'none',
  }
}

export function useButtonStyles(props: ButtonStylesProps) {
  const buttonStyles = computed(() => {
    switch (props.variant) {
      case 'filled':
        return getFilledStyles(props)
      case 'outlined':
        return getOutlinedStyles(props)
      case 'text':
      case 'icon':
        return getTextIconStyles(props)
      default:
        return {}
    }
  })

  return {
    buttonStyles,
  }
}
