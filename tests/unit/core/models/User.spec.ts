import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { User } from '@/models/User'

// Mock the getUserFullName utility
vi.mock('@/utils/user', () => ({
  default: vi.fn()
}))

describe('User', () => {
  let mockGetUserFullName: any

  beforeEach(async () => {
    // Get the mocked function
    const userUtils = await import('@/utils/user')
    mockGetUserFullName = userUtils.default
    
    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    test('should create a user with all properties', () => {
      mockGetUserFullName.mockReturnValue('John Doe')

      const user = new User(
        'user-123',
        'johndoe',
        'john@example.com',
        'John',
        'Doe'
      )

      expect(user.id).toBe('user-123')
      expect(user.username).toBe('johndoe')
      expect(user.email).toBe('john@example.com')
      expect(user.firstName).toBe('John')
      expect(user.lastName).toBe('Doe')
      expect(user.fullName).toBe('John Doe')
      expect(mockGetUserFullName).toHaveBeenCalledWith('John', 'Doe')
    })

    test('should handle empty names', () => {
      mockGetUserFullName.mockReturnValue('')

      const user = new User('', '', '', '', '')

      expect(user.id).toBe('')
      expect(user.username).toBe('')
      expect(user.email).toBe('')
      expect(user.firstName).toBe('')
      expect(user.lastName).toBe('')
      expect(user.fullName).toBe('')
      expect(mockGetUserFullName).toHaveBeenCalledWith('', '')
    })

    test('should handle null firstName and lastName', () => {
      mockGetUserFullName.mockReturnValue('Unknown User')

      const user = new User(
        'user-456',
        'unknown',
        'unknown@example.com',
        null as any,
        null as any
      )

      expect(user.firstName).toBeNull()
      expect(user.lastName).toBeNull()
      expect(user.fullName).toBe('Unknown User')
      expect(mockGetUserFullName).toHaveBeenCalledWith(null, null)
    })

    test('should handle undefined firstName and lastName', () => {
      mockGetUserFullName.mockReturnValue('Undefined User')

      const user = new User(
        'user-789',
        'undefined',
        'undefined@example.com',
        undefined as any,
        undefined as any
      )

      expect(user.firstName).toBeUndefined()
      expect(user.lastName).toBeUndefined()
      expect(user.fullName).toBe('Undefined User')
      expect(mockGetUserFullName).toHaveBeenCalledWith(undefined, undefined)
    })

    test('should handle only firstName', () => {
      mockGetUserFullName.mockReturnValue('Alice')

      const user = new User(
        'user-101',
        'alice',
        'alice@example.com',
        'Alice',
        ''
      )

      expect(user.firstName).toBe('Alice')
      expect(user.lastName).toBe('')
      expect(user.fullName).toBe('Alice')
      expect(mockGetUserFullName).toHaveBeenCalledWith('Alice', '')
    })

    test('should handle only lastName', () => {
      mockGetUserFullName.mockReturnValue('Smith')

      const user = new User(
        'user-102',
        'smith',
        'smith@example.com',
        '',
        'Smith'
      )

      expect(user.firstName).toBe('')
      expect(user.lastName).toBe('Smith')
      expect(user.fullName).toBe('Smith')
      expect(mockGetUserFullName).toHaveBeenCalledWith('', 'Smith')
    })

    test('should handle long names', () => {
      const longFirstName = 'A'.repeat(100)
      const longLastName = 'B'.repeat(100)
      const longFullName = `${longFirstName} ${longLastName}`
      
      mockGetUserFullName.mockReturnValue(longFullName)

      const user = new User(
        'user-long',
        'longname',
        'long@example.com',
        longFirstName,
        longLastName
      )

      expect(user.firstName).toBe(longFirstName)
      expect(user.lastName).toBe(longLastName)
      expect(user.fullName).toBe(longFullName)
    })

    test('should handle special characters in names', () => {
      mockGetUserFullName.mockReturnValue("José María O'Connor-Smith")

      const user = new User(
        'user-special',
        'jose.maria',
        'jose@example.com',
        'José María',
        "O'Connor-Smith"
      )

      expect(user.firstName).toBe('José María')
      expect(user.lastName).toBe("O'Connor-Smith")
      expect(user.fullName).toBe("José María O'Connor-Smith")
      expect(mockGetUserFullName).toHaveBeenCalledWith('José María', "O'Connor-Smith")
    })

    test('should handle unicode characters', () => {
      mockGetUserFullName.mockReturnValue('山田 太郎')

      const user = new User(
        'user-unicode',
        'yamada',
        'yamada@example.com',
        '山田',
        '太郎'
      )

      expect(user.firstName).toBe('山田')
      expect(user.lastName).toBe('太郎')
      expect(user.fullName).toBe('山田 太郎')
    })

    test('should handle different email formats', () => {
      mockGetUserFullName.mockReturnValue('Test User')

      const emailFormats = [
        'user@example.com',
        'user.name@example.co.uk',
        'user+tag@example.org',
        'user123@subdomain.example.com',
        'user_name@example-domain.com',
        'user-name@example.info'
      ]

      emailFormats.forEach(email => {
        const user = new User('id', 'username', email, 'Test', 'User')
        expect(user.email).toBe(email)
      })
    })

    test('should handle different username formats', () => {
      mockGetUserFullName.mockReturnValue('Test User')

      const usernameFormats = [
        'username',
        'user_name',
        'user-name',
        'user123',
        'user.name',
        'USERNAME',
        'User123'
      ]

      usernameFormats.forEach(username => {
        const user = new User('id', username, 'test@example.com', 'Test', 'User')
        expect(user.username).toBe(username)
      })
    })

    test('should handle different ID formats', () => {
      mockGetUserFullName.mockReturnValue('Test User')

      const idFormats = [
        '123',
        'user-123',
        'uuid-12345678-1234-1234-1234-123456789012',
        'email@example.com',
        'mongodb-objectid-507f1f77bcf86cd799439011'
      ]

      idFormats.forEach(id => {
        const user = new User(id, 'username', 'test@example.com', 'Test', 'User')
        expect(user.id).toBe(id)
      })
    })
  })

  describe('property access and modification', () => {
    let user: User

    beforeEach(() => {
      mockGetUserFullName.mockReturnValue('Jane Smith')
      user = new User(
        'user-456',
        'janesmith',
        'jane@example.com',
        'Jane',
        'Smith'
      )
    })

    test('should allow property access', () => {
      expect(user.id).toBe('user-456')
      expect(user.username).toBe('janesmith')
      expect(user.email).toBe('jane@example.com')
      expect(user.firstName).toBe('Jane')
      expect(user.lastName).toBe('Smith')
      expect(user.fullName).toBe('Jane Smith')
    })

    test('should allow property modification', () => {
      user.id = 'new-id'
      user.username = 'newusername'
      user.email = 'new@example.com'
      user.firstName = 'NewFirst'
      user.lastName = 'NewLast'
      user.fullName = 'New Full Name'

      expect(user.id).toBe('new-id')
      expect(user.username).toBe('newusername')
      expect(user.email).toBe('new@example.com')
      expect(user.firstName).toBe('NewFirst')
      expect(user.lastName).toBe('NewLast')
      expect(user.fullName).toBe('New Full Name')
    })

    test('should enumerate properties', () => {
      const keys = Object.keys(user)
      expect(keys).toContain('id')
      expect(keys).toContain('username')
      expect(keys).toContain('email')
      expect(keys).toContain('firstName')
      expect(keys).toContain('lastName')
      expect(keys).toContain('fullName')
    })

    test('should serialize to JSON correctly', () => {
      const json = JSON.stringify(user)
      const parsed = JSON.parse(json)

      expect(parsed.id).toBe('user-456')
      expect(parsed.username).toBe('janesmith')
      expect(parsed.email).toBe('jane@example.com')
      expect(parsed.firstName).toBe('Jane')
      expect(parsed.lastName).toBe('Smith')
      expect(parsed.fullName).toBe('Jane Smith')
    })

    test('should handle property deletion', () => {
      delete (user as any).firstName
      expect(user.firstName).toBeUndefined()
    })
  })

  describe('getUserFullName integration', () => {
    test('should call getUserFullName with correct parameters', () => {
      mockGetUserFullName.mockReturnValue('Full Name Result')

      const user = new User(
        'test-id',
        'testuser',
        'test@example.com',
        'First',
        'Last'
      )

      expect(mockGetUserFullName).toHaveBeenCalledTimes(1)
      expect(mockGetUserFullName).toHaveBeenCalledWith('First', 'Last')
      expect(user.fullName).toBe('Full Name Result')
    })

    test('should handle getUserFullName throwing an error', () => {
      mockGetUserFullName.mockImplementation(() => {
        throw new Error('getUserFullName error')
      })

      expect(() => {
        new User('id', 'username', 'email', 'First', 'Last')
      }).toThrow('getUserFullName error')
    })

    test('should handle getUserFullName returning different types', () => {
      const testCases = [
        null,
        undefined,
        123,
        true,
        {},
        [],
        () => 'function'
      ]

      testCases.forEach(returnValue => {
        mockGetUserFullName.mockReturnValue(returnValue)
        const user = new User('id', 'username', 'email', 'First', 'Last')
        expect(user.fullName).toBe(returnValue)
      })
    })

    test('should call getUserFullName only once during construction', () => {
      mockGetUserFullName.mockReturnValue('Test Name')

      new User('id', 'username', 'email', 'First', 'Last')

      expect(mockGetUserFullName).toHaveBeenCalledTimes(1)
    })
  })

  describe('edge cases', () => {
    test('should handle very long strings', () => {
      const longString = 'A'.repeat(10000)
      mockGetUserFullName.mockReturnValue(longString)

      const user = new User(
        longString,
        longString,
        `${longString}@example.com`,
        longString,
        longString
      )

      expect(user.id.length).toBe(10000)
      expect(user.firstName.length).toBe(10000)
      expect(user.fullName.length).toBe(10000)
    })

    test('should handle whitespace-only values', () => {
      mockGetUserFullName.mockReturnValue('   ')

      const user = new User(
        '   ',
        '   ',
        '   ',
        '   ',
        '   '
      )

      expect(user.id).toBe('   ')
      expect(user.firstName).toBe('   ')
      expect(user.fullName).toBe('   ')
    })

    test('should handle newlines and special whitespace', () => {
      mockGetUserFullName.mockReturnValue('Name\nWith\tSpecial\rChars')

      const user = new User(
        'id\n\t\r',
        'user\n\t\r',
        'email\n\t\r',
        'First\n\t\r',
        'Last\n\t\r'
      )

      expect(user.id).toContain('\n')
      expect(user.firstName).toContain('\t')
      expect(user.fullName).toContain('\r')
    })
  })
})
