import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockT = vi.fn((key: string) => key)
const mockTe = vi.fn((_key: string) => false)

vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    t: mockT,
    te: mockTe,
  })),
}))

let mockSectionTitlesConfig: Record<string, string> = {}

vi.mock('@cornflow-ui/core/app/config', () => ({
  default: {
    getCore: vi.fn(() => ({
      parameters: {
        get sectionTitles() {
          return mockSectionTitlesConfig
        },
      },
    })),
  },
}))

import { useSectionTitles } from '@cornflow-ui/core/composables/useSectionTitles'

describe('useSectionTitles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSectionTitlesConfig = {}
    mockT.mockImplementation((key: string) => key)
    mockTe.mockReturnValue(false)
  })

  test('getSectionTitle falls back to navigation key when no config and no app key', () => {
    const { getSectionTitle } = useSectionTitles()
    const result = getSectionTitle('executions')
    expect(mockT).toHaveBeenCalledWith('navigation.executions')
    expect(result).toBe('navigation.executions')
  })

  test('getSectionTitle uses custom key when configured and te() returns true', () => {
    mockSectionTitlesConfig = { masterData: 'custom.masterData' }
    mockTe.mockImplementation((key: string) => key === 'custom.masterData')
    mockT.mockImplementation((key: string) =>
      key === 'custom.masterData' ? 'Datos Maestros Custom' : key,
    )

    const { getSectionTitle } = useSectionTitles()
    const result = getSectionTitle('masterData')
    expect(result).toBe('Datos Maestros Custom')
  })

  test('getSectionTitle uses app-specific key when te() finds it', () => {
    mockTe.mockImplementation(
      (key: string) => key === 'sectionTitles.inputData',
    )
    mockT.mockImplementation((key: string) =>
      key === 'sectionTitles.inputData' ? 'Datos de Entrada' : key,
    )

    const { getSectionTitle } = useSectionTitles()
    const result = getSectionTitle('inputData')
    expect(result).toBe('Datos de Entrada')
  })

  test('getSectionTitle skips custom key when te() returns false for it', () => {
    mockSectionTitlesConfig = { results: 'custom.results' }
    mockTe.mockReturnValue(false)

    const { getSectionTitle } = useSectionTitles()
    const result = getSectionTitle('results')
    expect(result).toBe('navigation.results')
  })

  test('getAllSectionTitles returns all four sections', () => {
    const { getAllSectionTitles } = useSectionTitles()
    const titles = getAllSectionTitles()
    expect(titles).toHaveProperty('executions')
    expect(titles).toHaveProperty('masterData')
    expect(titles).toHaveProperty('inputData')
    expect(titles).toHaveProperty('results')
  })
})
