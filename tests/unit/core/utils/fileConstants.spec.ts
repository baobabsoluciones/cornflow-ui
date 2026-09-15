import { describe, test, expect } from 'vitest'
import {
  isExcelExtension,
  isSupportedDataExtension,
  getFileExtension,
  FILE_EXTENSIONS,
  EXCEL_EXTENSIONS,
  SUPPORTED_DATA_EXTENSIONS,
} from '@cornflow-ui/core/utils/fileConstants'

describe('isExcelExtension', () => {
  test.each(['xlsx', 'xls', 'xlsm', 'xlsb'])(
    'returns true for valid Excel extension "%s"',
    (ext) => {
      expect(isExcelExtension(ext)).toBe(true)
    },
  )

  test.each(['XLSX', 'XLS', 'XLSM', 'XLSB'])(
    'is case-insensitive: returns true for "%s"',
    (ext) => {
      expect(isExcelExtension(ext)).toBe(true)
    },
  )

  test.each(['Xlsx', 'xLsX', 'XlSm'])(
    'handles mixed case: returns true for "%s"',
    (ext) => {
      expect(isExcelExtension(ext)).toBe(true)
    },
  )

  test.each(['csv', 'json', 'pdf', 'txt', 'doc', ''])(
    'returns false for non-Excel extension "%s"',
    (ext) => {
      expect(isExcelExtension(ext)).toBe(false)
    },
  )
})

describe('isSupportedDataExtension', () => {
  test.each(['json', 'xlsx', 'csv'])(
    'returns true for supported extension "%s"',
    (ext) => {
      expect(isSupportedDataExtension(ext)).toBe(true)
    },
  )

  test.each(['JSON', 'XLSX', 'CSV'])(
    'is case-insensitive: returns true for "%s"',
    (ext) => {
      expect(isSupportedDataExtension(ext)).toBe(true)
    },
  )

  test.each(['xls', 'xlsm', 'xlsb', 'pdf', 'txt', 'xml', ''])(
    'returns false for unsupported extension "%s"',
    (ext) => {
      expect(isSupportedDataExtension(ext)).toBe(false)
    },
  )
})

describe('getFileExtension', () => {
  test('extracts extension from a simple filename', () => {
    expect(getFileExtension('report.xlsx')).toBe('xlsx')
  })

  test('returns lowercase extension regardless of input case', () => {
    expect(getFileExtension('report.XLSX')).toBe('xlsx')
    expect(getFileExtension('DATA.JSON')).toBe('json')
    expect(getFileExtension('file.CsV')).toBe('csv')
  })

  test('handles filenames with multiple dots', () => {
    expect(getFileExtension('my.report.v2.xlsx')).toBe('xlsx')
  })

  test('handles dotfiles', () => {
    expect(getFileExtension('.gitignore')).toBe('gitignore')
  })

  test('returns empty string for filenames without extension', () => {
    expect(getFileExtension('README')).toBe('readme')
  })

  test('handles filenames with path separators', () => {
    expect(getFileExtension('path/to/file.csv')).toBe('csv')
  })
})

describe('constants', () => {
  test('FILE_EXTENSIONS contains expected keys', () => {
    expect(FILE_EXTENSIONS.JSON).toBe('json')
    expect(FILE_EXTENSIONS.CSV).toBe('csv')
    expect(FILE_EXTENSIONS.XLSX).toBe('xlsx')
    expect(FILE_EXTENSIONS.XLS).toBe('xls')
    expect(FILE_EXTENSIONS.XLSM).toBe('xlsm')
    expect(FILE_EXTENSIONS.XLSB).toBe('xlsb')
  })

  test('EXCEL_EXTENSIONS contains all Excel formats', () => {
    expect(EXCEL_EXTENSIONS).toEqual(['xlsx', 'xls', 'xlsm', 'xlsb'])
  })

  test('SUPPORTED_DATA_EXTENSIONS contains json, xlsx, csv', () => {
    expect(SUPPORTED_DATA_EXTENSIONS).toEqual(['json', 'xlsx', 'csv'])
  })
})
