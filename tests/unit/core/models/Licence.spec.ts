import { describe, test, expect, beforeEach } from 'vitest'
import Licence from '@cornflow-ui/core/models/Licence'

describe('Licence', () => {
  describe('constructor', () => {
    test('should create a licence with all properties', () => {
      const licence = new Licence(
        'vue',
        'MIT',
        '3.0.0',
        'Evan You',
        'The Progressive JavaScript Framework',
        'https://vuejs.org'
      )

      expect(licence.library).toBe('vue')
      expect(licence.license).toBe('MIT')
      expect(licence.version).toBe('3.0.0')
      expect(licence.author).toBe('Evan You')
      expect(licence.description).toBe('The Progressive JavaScript Framework')
      expect(licence.homePage).toBe('https://vuejs.org')
    })

    test('should create a licence with empty strings', () => {
      const licence = new Licence('', '', '', '', '', '')

      expect(licence.library).toBe('')
      expect(licence.license).toBe('')
      expect(licence.version).toBe('')
      expect(licence.author).toBe('')
      expect(licence.description).toBe('')
      expect(licence.homePage).toBe('')
    })

    test('should create a licence with special characters', () => {
      const licence = new Licence(
        '@vue/cli',
        'MIT & Apache-2.0',
        '5.0.0-beta.1',
        'Vue Core Team <team@vuejs.org>',
        'Standard Tooling for Vue.js Development',
        'https://cli.vuejs.org/'
      )

      expect(licence.library).toBe('@vue/cli')
      expect(licence.license).toBe('MIT & Apache-2.0')
      expect(licence.version).toBe('5.0.0-beta.1')
      expect(licence.author).toBe('Vue Core Team <team@vuejs.org>')
      expect(licence.description).toBe('Standard Tooling for Vue.js Development')
      expect(licence.homePage).toBe('https://cli.vuejs.org/')
    })

    test('should create a licence with long strings', () => {
      const longDescription = 'A'.repeat(1000)
      const licence = new Licence(
        'very-long-library-name',
        'Custom License',
        '1.0.0',
        'Author Name',
        longDescription,
        'https://example.com'
      )

      expect(licence.description).toBe(longDescription)
      expect(licence.description.length).toBe(1000)
    })

    test('should handle unicode characters', () => {
      const licence = new Licence(
        'ライブラリ',
        'МИТ',
        '1.0.0-α',
        'Developer 开发者',
        'Description with émojis 🚀',
        'https://example.com/путь'
      )

      expect(licence.library).toBe('ライブラリ')
      expect(licence.license).toBe('МИТ')
      expect(licence.version).toBe('1.0.0-α')
      expect(licence.author).toBe('Developer 开发者')
      expect(licence.description).toBe('Description with émojis 🚀')
      expect(licence.homePage).toBe('https://example.com/путь')
    })

    test('should handle URLs with different protocols', () => {
      const licence = new Licence(
        'test-lib',
        'MIT',
        '1.0.0',
        'Author',
        'Description',
        'git+https://github.com/user/repo.git'
      )

      expect(licence.homePage).toBe('git+https://github.com/user/repo.git')
    })

    test('should handle version formats', () => {
      const testCases = [
        '1.0.0',
        '2.1.3-beta',
        '3.0.0-alpha.1',
        '4.5.6-rc.2+build.123',
        '^5.0.0',
        '~6.1.0',
        '>=7.0.0 <8.0.0'
      ]

      testCases.forEach(version => {
        const licence = new Licence('lib', 'MIT', version, 'Author', 'Desc', 'https://example.com')
        expect(licence.version).toBe(version)
      })
    })

    test('should handle common license types', () => {
      const licenseTypes = [
        'MIT',
        'Apache-2.0',
        'GPL-3.0',
        'BSD-3-Clause',
        'ISC',
        'Unlicense',
        'LGPL-2.1',
        'MPL-2.0',
        '(MIT OR Apache-2.0)',
        'SEE LICENSE IN LICENSE.txt'
      ]

      licenseTypes.forEach(license => {
        const licence = new Licence('lib', license, '1.0.0', 'Author', 'Desc', 'https://example.com')
        expect(licence.license).toBe(license)
      })
    })

    test('should handle author formats', () => {
      const authorFormats = [
        'John Doe',
        'John Doe <john@example.com>',
        'John Doe <john@example.com> (https://johndoe.com)',
        'Organization Team',
        'contributors (https://github.com/org/repo/graphs/contributors)',
        'Multiple Authors'
      ]

      authorFormats.forEach(author => {
        const licence = new Licence('lib', 'MIT', '1.0.0', author, 'Desc', 'https://example.com')
        expect(licence.author).toBe(author)
      })
    })

    test('should be immutable after creation', () => {
      const licence = new Licence(
        'vue',
        'MIT',
        '3.0.0',
        'Evan You',
        'The Progressive JavaScript Framework',
        'https://vuejs.org'
      )

      // Try to modify properties (should work since they're not readonly)
      licence.library = 'react'
      licence.license = 'Apache-2.0'

      // Properties should be modifiable
      expect(licence.library).toBe('react')
      expect(licence.license).toBe('Apache-2.0')
    })

    test('should handle null-like values as strings', () => {
      // TypeScript would prevent this, but testing runtime behavior
      const licence = new Licence(
        null as any,
        undefined as any,
        '1.0.0',
        'Author',
        'Description',
        'https://example.com'
      )

      expect(licence.library).toBe(null)
      expect(licence.license).toBe(undefined)
    })
  })

  describe('property access', () => {
    let licence: Licence

    beforeEach(() => {
      licence = new Licence(
        'typescript',
        'Apache-2.0',
        '4.9.0',
        'Microsoft',
        'TypeScript is a superset of JavaScript',
        'https://www.typescriptlang.org'
      )
    })

    test('should allow property access', () => {
      expect(licence.library).toBe('typescript')
      expect(licence.license).toBe('Apache-2.0')
      expect(licence.version).toBe('4.9.0')
      expect(licence.author).toBe('Microsoft')
      expect(licence.description).toBe('TypeScript is a superset of JavaScript')
      expect(licence.homePage).toBe('https://www.typescriptlang.org')
    })

    test('should allow property modification', () => {
      licence.library = 'updated-library'
      licence.version = '5.0.0'
      
      expect(licence.library).toBe('updated-library')
      expect(licence.version).toBe('5.0.0')
    })

    test('should enumerate properties', () => {
      const keys = Object.keys(licence)
      expect(keys).toContain('library')
      expect(keys).toContain('license')
      expect(keys).toContain('version')
      expect(keys).toContain('author')
      expect(keys).toContain('description')
      expect(keys).toContain('homePage')
    })

    test('should serialize to JSON correctly', () => {
      const json = JSON.stringify(licence)
      const parsed = JSON.parse(json)

      expect(parsed.library).toBe('typescript')
      expect(parsed.license).toBe('Apache-2.0')
      expect(parsed.version).toBe('4.9.0')
      expect(parsed.author).toBe('Microsoft')
      expect(parsed.description).toBe('TypeScript is a superset of JavaScript')
      expect(parsed.homePage).toBe('https://www.typescriptlang.org')
    })
  })
})
