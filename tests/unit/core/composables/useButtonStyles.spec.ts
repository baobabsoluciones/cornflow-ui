import { describe, test, expect } from 'vitest'
import { useButtonStyles } from '@/composables/core-button/useButtonStyles'

describe('useButtonStyles', () => {
  test('filled variant maps a known color to a CSS var and defaults text to white', () => {
    const { buttonStyles } = useButtonStyles({ variant: 'filled', color: 'primary' })
    expect(buttonStyles.value).toMatchObject({
      backgroundColor: 'var(--primary)',
      color: 'white',
      border: 'none',
    })
  })

  test('filled variant honours explicit background and text colors', () => {
    const { buttonStyles } = useButtonStyles({
      variant: 'filled',
      color: 'primary',
      backgroundColor: '#123',
      textColor: '#abc',
    })
    expect(buttonStyles.value.backgroundColor).toBe('#123')
    expect(buttonStyles.value.color).toBe('#abc')
  })

  test('filled variant passes through an unknown color verbatim', () => {
    const { buttonStyles } = useButtonStyles({ variant: 'filled', color: '#ff0000' })
    expect(buttonStyles.value.backgroundColor).toBe('#ff0000')
  })

  test('outlined variant builds border from resolved color', () => {
    const { buttonStyles } = useButtonStyles({ variant: 'outlined', color: 'warning' })
    expect(buttonStyles.value).toMatchObject({
      backgroundColor: 'transparent',
      color: 'var(--warning)',
      borderColor: 'var(--warning)',
      border: '2px solid var(--warning)',
    })
  })

  test('outlined variant uses raw color for border when textColor is set', () => {
    const { buttonStyles } = useButtonStyles({
      variant: 'outlined',
      color: 'primary',
      textColor: '#000',
    })
    expect(buttonStyles.value.color).toBe('#000')
    expect(buttonStyles.value.borderColor).toBe('primary')
  })

  test('text variant is transparent with resolved color', () => {
    const { buttonStyles } = useButtonStyles({ variant: 'text', color: 'primary' })
    expect(buttonStyles.value).toMatchObject({
      backgroundColor: 'transparent',
      color: 'var(--primary)',
      border: 'none',
    })
  })

  test('icon variant uses explicit textColor when provided', () => {
    const { buttonStyles } = useButtonStyles({
      variant: 'icon',
      color: 'primary',
      textColor: '#eee',
    })
    expect(buttonStyles.value.color).toBe('#eee')
  })

  test('unknown variant returns empty styles', () => {
    const { buttonStyles } = useButtonStyles({ variant: 'ghost' as any, color: 'primary' })
    expect(buttonStyles.value).toEqual({})
  })
})
