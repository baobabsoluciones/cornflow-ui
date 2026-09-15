import { describe, it, expect } from 'vitest'
import { useButtonStyles } from '@cornflow-ui/core/composables/core-button/useButtonStyles'
import type { ButtonStylesProps } from '@cornflow-ui/core/composables/core-button/useButtonStyles'

function makeProps(
  overrides: Partial<ButtonStylesProps> = {},
): ButtonStylesProps {
  return {
    variant: 'filled',
    color: 'primary',
    ...overrides,
  }
}

describe('useButtonStyles', () => {
  describe('filled variant', () => {
    it('uses resolved color as backgroundColor when no backgroundColor prop', () => {
      const { buttonStyles } = useButtonStyles(makeProps({ color: 'primary' }))
      expect(buttonStyles.value.backgroundColor).toBe('var(--primary)')
    })

    it('uses custom backgroundColor when provided', () => {
      const { buttonStyles } = useButtonStyles(
        makeProps({ backgroundColor: '#abc123' }),
      )
      expect(buttonStyles.value.backgroundColor).toBe('#abc123')
    })

    it("uses 'white' as text color by default", () => {
      const { buttonStyles } = useButtonStyles(makeProps())
      expect(buttonStyles.value.color).toBe('white')
    })

    it('uses custom textColor when provided', () => {
      const { buttonStyles } = useButtonStyles(
        makeProps({ textColor: '#000000' }),
      )
      expect(buttonStyles.value.color).toBe('#000000')
    })

    it("always has border: 'none'", () => {
      const { buttonStyles } = useButtonStyles(makeProps())
      expect(buttonStyles.value.border).toBe('none')
    })

    it('has box shadow', () => {
      const { buttonStyles } = useButtonStyles(makeProps())
      expect(buttonStyles.value.boxShadow).toBe('0 2px 4px rgba(0, 0, 0, 0.1)')
    })
  })

  describe('outlined variant', () => {
    it('has transparent background by default', () => {
      const { buttonStyles } = useButtonStyles(
        makeProps({ variant: 'outlined' }),
      )
      expect(buttonStyles.value.backgroundColor).toBe('transparent')
    })

    it('uses custom backgroundColor when provided', () => {
      const { buttonStyles } = useButtonStyles(
        makeProps({ variant: 'outlined', backgroundColor: '#fafafa' }),
      )
      expect(buttonStyles.value.backgroundColor).toBe('#fafafa')
    })

    it('uses resolved color for both text and border', () => {
      const { buttonStyles } = useButtonStyles(
        makeProps({ variant: 'outlined', color: 'warning' }),
      )
      expect(buttonStyles.value.color).toBe('var(--warning)')
      expect(buttonStyles.value.borderColor).toBe('var(--warning)')
    })

    it('when textColor is provided, uses original color for border', () => {
      const { buttonStyles } = useButtonStyles(
        makeProps({
          variant: 'outlined',
          color: 'primary',
          textColor: '#ff0000',
        }),
      )
      expect(buttonStyles.value.color).toBe('#ff0000')
      expect(buttonStyles.value.borderColor).toBe('primary')
    })

    it('has 2px solid border', () => {
      const { buttonStyles } = useButtonStyles(
        makeProps({ variant: 'outlined', color: 'primary' }),
      )
      expect(buttonStyles.value.border).toBe('2px solid var(--primary)')
    })

    it('has no box shadow', () => {
      const { buttonStyles } = useButtonStyles(
        makeProps({ variant: 'outlined' }),
      )
      expect(buttonStyles.value.boxShadow).toBe('none')
    })
  })

  describe('text variant', () => {
    it('always has transparent background', () => {
      const { buttonStyles } = useButtonStyles(
        makeProps({ variant: 'text', backgroundColor: '#fff' }),
      )
      expect(buttonStyles.value.backgroundColor).toBe('transparent')
    })

    it('uses resolved color for text', () => {
      const { buttonStyles } = useButtonStyles(
        makeProps({ variant: 'text', color: 'primary' }),
      )
      expect(buttonStyles.value.color).toBe('var(--primary)')
    })

    it('uses custom textColor when provided', () => {
      const { buttonStyles } = useButtonStyles(
        makeProps({ variant: 'text', textColor: '#123456' }),
      )
      expect(buttonStyles.value.color).toBe('#123456')
    })

    it('has no border and no shadow', () => {
      const { buttonStyles } = useButtonStyles(makeProps({ variant: 'text' }))
      expect(buttonStyles.value.border).toBe('none')
      expect(buttonStyles.value.boxShadow).toBe('none')
    })
  })

  describe('icon variant', () => {
    it('produces the same styles as text variant', () => {
      const props = { color: 'warning', textColor: '#aaa' } as const
      const { buttonStyles: iconStyles } = useButtonStyles(
        makeProps({ variant: 'icon', ...props }),
      )
      const { buttonStyles: textStyles } = useButtonStyles(
        makeProps({ variant: 'text', ...props }),
      )
      expect(iconStyles.value).toEqual(textStyles.value)
    })
  })

  describe('color resolution', () => {
    it("'primary' resolves to 'var(--primary)'", () => {
      const { buttonStyles } = useButtonStyles(makeProps({ color: 'primary' }))
      expect(buttonStyles.value.backgroundColor).toBe('var(--primary)')
    })

    it("'warning' resolves to 'var(--warning)'", () => {
      const { buttonStyles } = useButtonStyles(makeProps({ color: 'warning' }))
      expect(buttonStyles.value.backgroundColor).toBe('var(--warning)')
    })

    it('unknown colors pass through unchanged', () => {
      const { buttonStyles } = useButtonStyles(makeProps({ color: '#ff0000' }))
      expect(buttonStyles.value.backgroundColor).toBe('#ff0000')
    })
  })
})
