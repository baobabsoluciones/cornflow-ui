import { describe, test, expect, vi } from 'vitest'
import {
  isExcelExtension,
  isSupportedDataExtension,
  getFileExtension,
  FILE_EXTENSIONS,
  EXCEL_EXTENSIONS,
  SUPPORTED_DATA_EXTENSIONS,
  resolveAllowedExtensions,
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

describe('resolveAllowedExtensions', () => {
  const FALLBACK = SUPPORTED_DATA_EXTENSIONS

  test.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty array', []],
    ['a non-array', 'xlsx'],
  ])('falls back when the config is %s', (_label, configured) => {
    expect(resolveAllowedExtensions(configured, FALLBACK)).toBe(FALLBACK)
  })

  test('narrows to what the deployment configured', () => {
    expect(resolveAllowedExtensions(['xlsx'], FALLBACK)).toEqual(['xlsx'])
  })

  test('normalises case, surrounding space and a leading dot', () => {
    expect(resolveAllowedExtensions([' .XLSX ', 'Csv'], FALLBACK)).toEqual([
      'xlsx',
      'csv',
    ])
  })

  test('allows the Excel variants the parser can read but the default omits', () => {
    // The default list is json/xlsx/csv, yet processFileContent reads xls, xlsm and xlsb
    // too, so a deployment is free to opt into them.
    expect(resolveAllowedExtensions(['xls', 'xlsm', 'xlsb'], FALLBACK)).toEqual([
      'xls',
      'xlsm',
      'xlsb',
    ])
  })

  test('drops extensions the core cannot read, and says so', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Accepting 'txt' would only move the rejection to the parser, after the user has
    // already been told the file was fine.
    expect(resolveAllowedExtensions(['xlsx', 'txt', 'pdf'], FALLBACK)).toEqual([
      'xlsx',
    ])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('txt, pdf'))

    warn.mockRestore()
  })

  test('falls back when nothing configured is usable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // A typo must not leave the drop zone accepting nothing at all.
    expect(resolveAllowedExtensions(['xslx'], FALLBACK)).toBe(FALLBACK)
    expect(warn).toHaveBeenCalled()

    warn.mockRestore()
  })

  test('ignores non-string entries', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(resolveAllowedExtensions(['xlsx', 42, null, {}], FALLBACK)).toEqual([
      'xlsx',
    ])

    warn.mockRestore()
  })

  test('de-duplicates', () => {
    expect(resolveAllowedExtensions(['xlsx', '.xlsx', 'XLSX'], FALLBACK)).toEqual([
      'xlsx',
    ])
  })
})
