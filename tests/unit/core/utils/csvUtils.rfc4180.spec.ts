import { describe, expect, it } from 'vitest'
import {
  detectDelimiter,
  parseCsvContent,
  parseCsvToData,
  extractTableName,
} from '@cornflow-ui/core/utils/csvUtils'

describe('csvUtils - RFC 4180 branches', () => {
  describe('parseCsvContent quoted fields', () => {
    it('handles embedded delimiter inside quotes', () => {
      const csv = 'name,note\n"Doe, John","a, b, c"'
      const result = parseCsvContent(csv, ',')
      expect(result.tableData).toEqual([
        { name: 'Doe, John', note: 'a, b, c' },
      ])
    })

    it('handles escaped quotes ("")', () => {
      const csv = 'name,quote\nJohn,"He said ""hi"""'
      const result = parseCsvContent(csv, ',')
      expect(result.tableData).toEqual([
        { name: 'John', quote: 'He said "hi"' },
      ])
    })

    it('handles embedded newline inside quoted field', () => {
      const csv = 'name,address\nJohn,"Line 1\nLine 2"'
      const result = parseCsvContent(csv, ',')
      expect(result.tableData).toEqual([
        { name: 'John', address: 'Line 1\nLine 2' },
      ])
    })

    it('treats a quote not at field start as a regular char', () => {
      // Opening quote only counts when the field has not started yet
      const csv = 'name,val\nJohn,ab"cd'
      const result = parseCsvContent(csv, ',')
      expect(result.tableData[0].val).toBe('ab"cd')
    })

    it('handles semicolon delimiter with quotes', () => {
      const csv = 'name;note\n"Doe; John";"x;y"'
      const result = parseCsvContent(csv, ';')
      expect(result.tableData).toEqual([
        { name: 'Doe; John', note: 'x;y' },
      ])
    })
  })

  describe('parseCsvContent line endings', () => {
    it('normalizes CRLF line endings', () => {
      const csv = 'name,age\r\nJohn,25\r\nJane,30'
      const result = parseCsvContent(csv, ',')
      expect(result.headers).toEqual(['name', 'age'])
      expect(result.tableData).toEqual([
        { name: 'John', age: '25' },
        { name: 'Jane', age: '30' },
      ])
    })

    it('normalizes lone CR line endings', () => {
      const csv = 'name,age\rJohn,25'
      const result = parseCsvContent(csv, ',')
      expect(result.tableData).toEqual([{ name: 'John', age: '25' }])
    })
  })

  describe('parseCsvContent edge cases', () => {
    it('returns empty result for empty text', () => {
      const result = parseCsvContent('', ',')
      expect(result.headers).toEqual([])
      expect(result.tableData).toEqual([])
    })

    it('trims header whitespace', () => {
      const csv = ' name , age \nJohn,25'
      const result = parseCsvContent(csv, ',')
      expect(result.headers).toEqual(['name', 'age'])
      expect(result.tableData).toEqual([{ name: 'John', age: '25' }])
    })

    it('filters rows where all values are empty', () => {
      const csv = 'a,b\n,\nx,y'
      const result = parseCsvContent(csv, ',')
      expect(result.tableData).toEqual([{ a: 'x', b: 'y' }])
    })

    it('finishes a trailing field without newline', () => {
      const csv = 'a,b\n1,2'
      const result = parseCsvContent(csv, ',')
      expect(result.tableData).toEqual([{ a: '1', b: '2' }])
    })
  })

  describe('detectDelimiter ties and defaults', () => {
    it('defaults to comma on a tie (comma counted first / not greater)', () => {
      const csv = 'a;b,c'
      // counts: comma=1, semicolon=1 -> first max wins, comma stays default
      expect(detectDelimiter(csv)).toBe(',')
    })

    it('only inspects the first line', () => {
      const csv = 'a,b\nx;y;z;w'
      expect(detectDelimiter(csv)).toBe(',')
    })
  })

  describe('extractTableName', () => {
    it('handles leading dot filenames', () => {
      expect(extractTableName('.gitignore')).toBe('')
    })
  })

  describe('parseCsvToData integration with quotes', () => {
    it('auto-detects delimiter and parses quoted content', () => {
      const csv = 'id,desc\n1,"a, b"'
      const result = parseCsvToData(csv, 'records.csv')
      expect(result.tableName).toBe('records')
      expect(result.data).toEqual({ records: [{ id: '1', desc: 'a, b' }] })
    })
  })
})
