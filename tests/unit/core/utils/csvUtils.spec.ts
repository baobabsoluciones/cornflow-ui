import { describe, test, expect } from 'vitest'
import { detectDelimiter, parseCsvContent, extractTableName, parseCsvToData } from '@/utils/csvUtils'

describe('csvUtils', () => {
  describe('detectDelimiter', () => {
    test('should detect comma delimiter', () => {
      const csvText = 'name,age,city\nJohn,25,NYC'
      const delimiter = detectDelimiter(csvText)
      expect(delimiter).toBe(',')
    })

    test('should detect semicolon delimiter', () => {
      const csvText = 'name;age;city\nJohn;25;NYC'
      const delimiter = detectDelimiter(csvText)
      expect(delimiter).toBe(';')
    })

    test('should detect tab delimiter', () => {
      const csvText = 'name\tage\tcity\nJohn\t25\tNYC'
      const delimiter = detectDelimiter(csvText)
      expect(delimiter).toBe('\t')
    })

    test('should default to comma when no clear delimiter', () => {
      const csvText = 'name age city\nJohn 25 NYC'
      const delimiter = detectDelimiter(csvText)
      expect(delimiter).toBe(',')
    })

    test('should handle empty string', () => {
      const csvText = ''
      const delimiter = detectDelimiter(csvText)
      expect(delimiter).toBe(',')
    })
  })

  describe('parseCsvContent', () => {
    test('should parse CSV with comma delimiter correctly', () => {
      const csvText = 'name,age,city\nJohn,25,NYC\nJane,30,LA'
      const result = parseCsvContent(csvText, ',')
      
      expect(result.headers).toEqual(['name', 'age', 'city'])
      expect(result.tableData).toEqual([
        { name: 'John', age: 25, city: 'NYC' },
        { name: 'Jane', age: 30, city: 'LA' }
      ])
    })

    test('should parse CSV with semicolon delimiter', () => {
      const csvText = 'name;age;city\nJohn;25;NYC'
      const result = parseCsvContent(csvText, ';')
      
      expect(result.headers).toEqual(['name', 'age', 'city'])
      expect(result.tableData).toEqual([
        { name: 'John', age: 25, city: 'NYC' }
      ])
    })

    test('should handle quoted values (simple quotes)', () => {
      const csvText = 'name,description\n"John","Simple description"\n\'Jane\',"Another description"'
      const result = parseCsvContent(csvText, ',')
      
      expect(result.tableData).toEqual([
        { name: 'John', description: 'Simple description' },
        { name: 'Jane', description: 'Another description' }
      ])
    })

    test('should convert numeric values', () => {
      const csvText = 'name,age,score\nJohn,25,85.5\nJane,30,90'
      const result = parseCsvContent(csvText, ',')
      
      expect(result.tableData).toEqual([
        { name: 'John', age: 25, score: 85.5 },
        { name: 'Jane', age: 30, score: 90 }
      ])
    })

    test('should skip empty lines', () => {
      const csvText = 'name,age\nJohn,25\n\nJane,30\n'
      const result = parseCsvContent(csvText, ',')
      
      expect(result.tableData).toEqual([
        { name: 'John', age: 25 },
        { name: 'Jane', age: 30 }
      ])
    })

    test('should handle mismatched columns', () => {
      const csvText = 'name,age,city\nJohn,25\nJane,30,LA,Extra'
      const result = parseCsvContent(csvText, ',')
      
      expect(result.tableData).toEqual([
        { name: 'John', age: 25 },
        { name: 'Jane', age: 30, city: 'LA' }
      ])
    })

    test('should handle empty values', () => {
      const csvText = 'name,age,city\nJohn,,NYC\n,25,LA'
      const result = parseCsvContent(csvText, ',')
      
      expect(result.tableData).toEqual([
        { name: 'John', age: '', city: 'NYC' },
        { name: '', age: 25, city: 'LA' }
      ])
    })
  })

  describe('extractTableName', () => {
    test('should extract table name from filename', () => {
      expect(extractTableName('data.csv')).toBe('data')
      expect(extractTableName('users.xlsx')).toBe('users')
      expect(extractTableName('report.json')).toBe('report')
    })

    test('should handle filename without extension', () => {
      expect(extractTableName('data')).toBe('data')
    })

    test('should handle filename with multiple dots', () => {
      expect(extractTableName('data.backup.csv')).toBe('data')
    })

    test('should handle empty filename', () => {
      expect(extractTableName('')).toBe('')
    })
  })

  describe('parseCsvToData', () => {
    test('should parse CSV and return formatted data structure', () => {
      const csvText = 'name,age\nJohn,25\nJane,30'
      const fileName = 'users.csv'
      
      const result = parseCsvToData(csvText, fileName)
      
      expect(result.tableName).toBe('users')
      expect(result.data).toEqual({
        users: [
          { name: 'John', age: 25 },
          { name: 'Jane', age: 30 }
        ]
      })
    })

    test('should handle semicolon delimiter automatically', () => {
      const csvText = 'name;age;city\nJohn;25;NYC'
      const fileName = 'data.csv'
      
      const result = parseCsvToData(csvText, fileName)
      
      expect(result.data).toEqual({
        data: [
          { name: 'John', age: 25, city: 'NYC' }
        ]
      })
    })

    test('should handle tab delimiter automatically', () => {
      const csvText = 'name\tage\nJohn\t25'
      const fileName = 'test.csv'
      
      const result = parseCsvToData(csvText, fileName)
      
      expect(result.data).toEqual({
        test: [
          { name: 'John', age: 25 }
        ]
      })
    })
  })

  describe('edge cases', () => {
    test('should handle CSV with only headers', () => {
      const csvText = 'name,age,city'
      const result = parseCsvContent(csvText, ',')
      
      expect(result.headers).toEqual(['name', 'age', 'city'])
      expect(result.tableData).toEqual([])
    })

    test('should handle single column CSV', () => {
      const csvText = 'name\nJohn\nJane'
      const result = parseCsvContent(csvText, ',')
      
      expect(result.headers).toEqual(['name'])
      expect(result.tableData).toEqual([
        { name: 'John' },
        { name: 'Jane' }
      ])
    })

    test('should handle CSV with special characters (without multiline)', () => {
      const csvText = 'name,description\nJohn,"Simple text"\nJane,Special@#$%'
      const result = parseCsvContent(csvText, ',')
      
      expect(result.tableData[0].description).toBe('Simple text')
      expect(result.tableData[1].description).toBe('Special@#$%')
    })

    test('should convert valid numbers but keep mixed strings', () => {
      const csvText = 'id,code\n001,123abc\n002,456'
      const result = parseCsvContent(csvText, ',')
      
      expect(result.tableData).toEqual([
        { id: 1, code: '123abc' },
        { id: 2, code: 456 }
      ])
    })
  })
})
