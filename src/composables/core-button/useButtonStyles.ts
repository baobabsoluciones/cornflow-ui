import { computed } from 'vue'

export interface ButtonStylesProps {
  variant: 'filled' | 'outlined' | 'text' | 'icon'
  color: string
  backgroundColor?: string | null
  textColor?: string | null
}

export function useButtonStyles(props: ButtonStylesProps) {
  const buttonStyles = computed(() => {
    const styles: Record<string, string> = {}

    // Get CSS variables for default colors
    const primaryColor = 'var(--primary)'
    const primaryVariant = 'var(--primary-variant)'
    const warningColor = 'var(--warning)'

    // Determine colors based on variant and props
    switch (props.variant) {
      case 'filled':
        if (props.backgroundColor) {
          styles.backgroundColor = props.backgroundColor
        } else {
          switch (props.color) {
            case 'primary':
              styles.backgroundColor = primaryColor
              break
            case 'warning':
              styles.backgroundColor = warningColor
              break
            default:
              styles.backgroundColor = props.color
          }
        }

        if (props.textColor) {
          styles.color = props.textColor
        } else {
          styles.color = 'white'
        }

        styles.border = 'none'
        styles.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'
        break

      case 'outlined':
        if (props.backgroundColor) {
          styles.backgroundColor = props.backgroundColor
        } else {
          styles.backgroundColor = 'transparent'
        }

        if (props.textColor) {
          styles.color = props.textColor
        } else {
          switch (props.color) {
            case 'primary':
              styles.color = primaryColor
              styles.borderColor = primaryColor
              break
            case 'warning':
              styles.color = warningColor
              styles.borderColor = warningColor
              break
            default:
              styles.color = props.color
              styles.borderColor = props.color
          }
        }

        styles.border = `2px solid ${styles.borderColor || props.color}`
        styles.boxShadow = 'none'
        break

      case 'text':
        styles.backgroundColor = 'transparent'

        if (props.textColor) {
          styles.color = props.textColor
        } else {
          switch (props.color) {
            case 'primary':
              styles.color = primaryColor
              break
            case 'warning':
              styles.color = warningColor
              break
            default:
              styles.color = props.color
          }
        }

        styles.border = 'none'
        styles.boxShadow = 'none'
        break

      case 'icon':
        styles.backgroundColor = 'transparent'

        if (props.textColor) {
          styles.color = props.textColor
        } else {
          switch (props.color) {
            case 'primary':
              styles.color = primaryColor
              break
            case 'warning':
              styles.color = warningColor
              break
            default:
              styles.color = props.color
          }
        }

        styles.border = 'none'
        styles.boxShadow = 'none'
        break
    }

    return styles
  })

  return {
    buttonStyles,
  }
}
