import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock webfontloader
const mockWebFontLoader = {
  load: vi.fn()
}

// Mock the dynamic import
vi.mock('webfontloader', () => mockWebFontLoader)

describe('plugins/webfontloader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should load Google Roboto fonts', async () => {
    const { loadFonts } = await import('@/plugins/webfontloader')
    await loadFonts()

    expect(mockWebFontLoader.load).toHaveBeenCalledTimes(1)
    expect(mockWebFontLoader.load).toHaveBeenCalledWith({
      google: {
        families: ['Roboto:100,300,400,500,700,900&display=swap'],
      },
    })
  })

  test('should be an async function', async () => {
    const { loadFonts } = await import('@/plugins/webfontloader')
    expect(loadFonts).toBeInstanceOf(Function)
    
    const result = loadFonts()
    expect(result).toBeInstanceOf(Promise)
    await result
  })

  test('should use correct font configuration', async () => {
    const { loadFonts } = await import('@/plugins/webfontloader')
    await loadFonts()

    const loadCall = mockWebFontLoader.load.mock.calls[0][0]
    expect(loadCall.google).toBeDefined()
    expect(loadCall.google.families).toEqual(['Roboto:100,300,400,500,700,900&display=swap'])
  })

  test('should only load Google fonts', async () => {
    const { loadFonts } = await import('@/plugins/webfontloader')
    await loadFonts()

    const loadCall = mockWebFontLoader.load.mock.calls[0][0]
    expect(Object.keys(loadCall)).toEqual(['google'])
  })

  test('should include all Roboto font weights', async () => {
    const { loadFonts } = await import('@/plugins/webfontloader')
    await loadFonts()

    const loadCall = mockWebFontLoader.load.mock.calls[0][0]
    const fontFamily = loadCall.google.families[0]
    
    expect(fontFamily).toContain('100')
    expect(fontFamily).toContain('300')
    expect(fontFamily).toContain('400')
    expect(fontFamily).toContain('500')
    expect(fontFamily).toContain('700')
    expect(fontFamily).toContain('900')
    expect(fontFamily).toContain('display=swap')
  })

  test('should handle webfontloader.load error', async () => {
    mockWebFontLoader.load.mockImplementation(() => {
      throw new Error('Font loading failed')
    })

    const { loadFonts } = await import('@/plugins/webfontloader')
    await expect(loadFonts()).rejects.toThrow('Font loading failed')
  })
})
