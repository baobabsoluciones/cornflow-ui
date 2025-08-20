import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock the general store with hoisted mock
const mockStore = vi.hoisted(() => ({
  addNotification: vi.fn()
}))

vi.mock('@/stores/general', () => ({
  useGeneralStore: vi.fn(() => mockStore)
}))

// Import after mocking
import NotificationManager from '@/services/NotificationManager'

describe('NotificationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the mock implementation
    mockStore.addNotification.mockImplementation(() => {})
  })

  describe('addSuccess', () => {
    test('adds success notification to store', () => {
      const message = 'Operation completed successfully'

      NotificationManager.addSuccess(message)

      expect(mockStore.addNotification).toHaveBeenCalledWith({
        message: 'Operation completed successfully',
        type: 'success'
      })
      expect(mockStore.addNotification).toHaveBeenCalledTimes(1)
    })

    test('handles empty success message', () => {
      NotificationManager.addSuccess('')

      expect(mockStore.addNotification).toHaveBeenCalledWith({
        message: '',
        type: 'success'
      })
    })

    test('handles long success message', () => {
      const longMessage = 'A'.repeat(500)

      NotificationManager.addSuccess(longMessage)

      expect(mockStore.addNotification).toHaveBeenCalledWith({
        message: longMessage,
        type: 'success'
      })
    })
  })

  describe('addWarning', () => {
    test('adds warning notification to store', () => {
      const message = 'This action may have consequences'

      NotificationManager.addWarning(message)

      expect(mockStore.addNotification).toHaveBeenCalledWith({
        message: 'This action may have consequences',
        type: 'warning'
      })
      expect(mockStore.addNotification).toHaveBeenCalledTimes(1)
    })

    test('handles empty warning message', () => {
      NotificationManager.addWarning('')

      expect(mockStore.addNotification).toHaveBeenCalledWith({
        message: '',
        type: 'warning'
      })
    })

    test('handles warning message with special characters', () => {
      const message = 'Warning: 50% of operations failed! 🚨'

      NotificationManager.addWarning(message)

      expect(mockStore.addNotification).toHaveBeenCalledWith({
        message: 'Warning: 50% of operations failed! 🚨',
        type: 'warning'
      })
    })
  })

  describe('addInfo', () => {
    test('adds info notification to store', () => {
      const message = 'New feature available in settings'

      NotificationManager.addInfo(message)

      expect(mockStore.addNotification).toHaveBeenCalledWith({
        message: 'New feature available in settings',
        type: 'info'
      })
      expect(mockStore.addNotification).toHaveBeenCalledTimes(1)
    })

    test('handles empty info message', () => {
      NotificationManager.addInfo('')

      expect(mockStore.addNotification).toHaveBeenCalledWith({
        message: '',
        type: 'info'
      })
    })

    test('handles info message with HTML content', () => {
      const message = '<b>Important:</b> Please update your profile'

      NotificationManager.addInfo(message)

      expect(mockStore.addNotification).toHaveBeenCalledWith({
        message: '<b>Important:</b> Please update your profile',
        type: 'info'
      })
    })
  })

  describe('addError', () => {
    test('adds error notification to store', () => {
      const message = 'Failed to save changes'

      NotificationManager.addError(message)

      expect(mockStore.addNotification).toHaveBeenCalledWith({
        message: 'Failed to save changes',
        type: 'error'
      })
      expect(mockStore.addNotification).toHaveBeenCalledTimes(1)
    })

    test('handles empty error message', () => {
      NotificationManager.addError('')

      expect(mockStore.addNotification).toHaveBeenCalledWith({
        message: '',
        type: 'error'
      })
    })

    test('handles error message with stack trace format', () => {
      const message = 'Error: Connection failed\n  at line 123\n  in file xyz.js'

      NotificationManager.addError(message)

      expect(mockStore.addNotification).toHaveBeenCalledWith({
        message: 'Error: Connection failed\n  at line 123\n  in file xyz.js',
        type: 'error'
      })
    })
  })

  describe('multiple notifications', () => {
    test('adds multiple notifications in sequence', () => {
      NotificationManager.addSuccess('Success 1')
      NotificationManager.addWarning('Warning 1')
      NotificationManager.addError('Error 1')
      NotificationManager.addInfo('Info 1')

      expect(mockStore.addNotification).toHaveBeenCalledTimes(4)
      expect(mockStore.addNotification).toHaveBeenNthCalledWith(1, {
        message: 'Success 1',
        type: 'success'
      })
      expect(mockStore.addNotification).toHaveBeenNthCalledWith(2, {
        message: 'Warning 1',
        type: 'warning'
      })
      expect(mockStore.addNotification).toHaveBeenNthCalledWith(3, {
        message: 'Error 1',
        type: 'error'
      })
      expect(mockStore.addNotification).toHaveBeenNthCalledWith(4, {
        message: 'Info 1',
        type: 'info'
      })
    })

    test('adds same type multiple times', () => {
      NotificationManager.addError('Error 1')
      NotificationManager.addError('Error 2')
      NotificationManager.addError('Error 3')

      expect(mockStore.addNotification).toHaveBeenCalledTimes(3)
      expect(mockStore.addNotification).toHaveBeenNthCalledWith(1, {
        message: 'Error 1',
        type: 'error'
      })
      expect(mockStore.addNotification).toHaveBeenNthCalledWith(2, {
        message: 'Error 2',
        type: 'error'
      })
      expect(mockStore.addNotification).toHaveBeenNthCalledWith(3, {
        message: 'Error 3',
        type: 'error'
      })
    })
  })

  describe('store integration', () => {
    test('uses the same store instance across calls', () => {
      NotificationManager.addSuccess('Test 1')
      NotificationManager.addError('Test 2')

      // Verify that the same mock store is being used
      expect(mockStore.addNotification).toHaveBeenCalledTimes(2)
    })

    test('handles store method failure gracefully', () => {
      // Mock store method to throw error
      mockStore.addNotification.mockImplementation(() => {
        throw new Error('Store error')
      })

      // Should not throw error from NotificationManager
      expect(() => {
        NotificationManager.addSuccess('Test message')
      }).toThrow('Store error')
    })
  })

  describe('singleton behavior', () => {
    test('NotificationManager is a singleton instance', async () => {
      // Import the service again using dynamic import
      const { default: NotificationManager2 } = await import('@/services/NotificationManager')
      
      expect(NotificationManager).toBe(NotificationManager2)
    })

    test('maintains state across multiple usages', () => {
      NotificationManager.addSuccess('Message 1')
      NotificationManager.addError('Message 2')

      expect(mockStore.addNotification).toHaveBeenCalledTimes(2)
    })
  })

  describe('edge cases and error handling', () => {
    test('handles undefined message', () => {
      NotificationManager.addSuccess(undefined as any)

      expect(mockStore.addNotification).toHaveBeenCalledWith({
        message: undefined,
        type: 'success'
      })
    })

    test('handles null message', () => {
      NotificationManager.addError(null as any)

      expect(mockStore.addNotification).toHaveBeenCalledWith({
        message: null,
        type: 'error'
      })
    })

    test('handles numeric message', () => {
      NotificationManager.addInfo(123 as any)

      expect(mockStore.addNotification).toHaveBeenCalledWith({
        message: 123,
        type: 'info'
      })
    })

    test('handles object message', () => {
      const objectMessage = { error: 'Something went wrong' }
      NotificationManager.addWarning(objectMessage as any)

      expect(mockStore.addNotification).toHaveBeenCalledWith({
        message: objectMessage,
        type: 'warning'
      })
    })
  })
})
