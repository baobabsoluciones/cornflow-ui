import { describe, test, expect, beforeEach } from 'vitest'
import { snackbar, showSnackbar } from '@/services/SnackbarService'

describe('SnackbarService', () => {
  beforeEach(() => {
    // Reset snackbar state before each test
    snackbar.show = false
    snackbar.message = ''
    snackbar.color = 'success'
  })

  describe('snackbar reactive object', () => {
    test('has correct initial state', () => {
      expect(snackbar.show).toBe(false)
      expect(snackbar.message).toBe('')
      expect(snackbar.color).toBe('success')
    })

    test('is reactive and can be modified', () => {
      snackbar.show = true
      snackbar.message = 'Test message'
      snackbar.color = 'error'

      expect(snackbar.show).toBe(true)
      expect(snackbar.message).toBe('Test message')
      expect(snackbar.color).toBe('error')
    })
  })

  describe('showSnackbar function', () => {
    test('shows snackbar with success color by default', () => {
      showSnackbar('Success message')

      expect(snackbar.show).toBe(true)
      expect(snackbar.message).toBe('Success message')
      expect(snackbar.color).toBe('success')
    })

    test('shows snackbar with custom color', () => {
      showSnackbar('Error message', 'error')

      expect(snackbar.show).toBe(true)
      expect(snackbar.message).toBe('Error message')
      expect(snackbar.color).toBe('error')
    })

    test('shows snackbar with warning color', () => {
      showSnackbar('Warning message', 'warning')

      expect(snackbar.show).toBe(true)
      expect(snackbar.message).toBe('Warning message')
      expect(snackbar.color).toBe('warning')
    })

    test('shows snackbar with info color', () => {
      showSnackbar('Info message', 'info')

      expect(snackbar.show).toBe(true)
      expect(snackbar.message).toBe('Info message')
      expect(snackbar.color).toBe('info')
    })

    test('overwrites previous snackbar state', () => {
      // Set initial state
      showSnackbar('First message', 'success')
      expect(snackbar.message).toBe('First message')
      expect(snackbar.color).toBe('success')

      // Overwrite with new state
      showSnackbar('Second message', 'error')
      expect(snackbar.message).toBe('Second message')
      expect(snackbar.color).toBe('error')
      expect(snackbar.show).toBe(true)
    })

    test('handles empty message', () => {
      showSnackbar('')

      expect(snackbar.show).toBe(true)
      expect(snackbar.message).toBe('')
      expect(snackbar.color).toBe('success')
    })

    test('handles undefined color parameter', () => {
      showSnackbar('Test message', undefined)

      expect(snackbar.show).toBe(true)
      expect(snackbar.message).toBe('Test message')
      expect(snackbar.color).toBe('success') // Should default to success
    })

    test('handles null color parameter', () => {
      showSnackbar('Test message', null)

      expect(snackbar.show).toBe(true)
      expect(snackbar.message).toBe('Test message')
      expect(snackbar.color).toBeNull()
    })

    test('accepts any string as color', () => {
      showSnackbar('Test message', 'custom-color')

      expect(snackbar.show).toBe(true)
      expect(snackbar.message).toBe('Test message')
      expect(snackbar.color).toBe('custom-color')
    })
  })

  describe('multiple calls behavior', () => {
    test('multiple calls update the same reactive object', () => {
      showSnackbar('Message 1', 'info')
      const firstCall = snackbar

      showSnackbar('Message 2', 'warning')
      const secondCall = snackbar

      expect(firstCall).toBe(secondCall) // Same object reference
      expect(snackbar.message).toBe('Message 2')
      expect(snackbar.color).toBe('warning')
    })

    test('show property remains true across multiple calls', () => {
      showSnackbar('Message 1')
      expect(snackbar.show).toBe(true)

      showSnackbar('Message 2')
      expect(snackbar.show).toBe(true)

      showSnackbar('Message 3')
      expect(snackbar.show).toBe(true)
    })
  })

  describe('edge cases', () => {
    test('handles very long messages', () => {
      const longMessage = 'A'.repeat(1000)
      showSnackbar(longMessage, 'info')

      expect(snackbar.show).toBe(true)
      expect(snackbar.message).toBe(longMessage)
      expect(snackbar.color).toBe('info')
    })

    test('handles special characters in message', () => {
      const specialMessage = '🚀 Special chars: @#$%^&*()[]{}|\\:";\'<>?,./'
      showSnackbar(specialMessage, 'success')

      expect(snackbar.show).toBe(true)
      expect(snackbar.message).toBe(specialMessage)
      expect(snackbar.color).toBe('success')
    })

    test('handles HTML in message', () => {
      const htmlMessage = '<script>alert("test")</script><b>Bold text</b>'
      showSnackbar(htmlMessage, 'warning')

      expect(snackbar.show).toBe(true)
      expect(snackbar.message).toBe(htmlMessage)
      expect(snackbar.color).toBe('warning')
    })
  })
})
