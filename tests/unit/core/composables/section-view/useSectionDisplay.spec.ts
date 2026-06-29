import { describe, test, expect, vi } from 'vitest'
import { ref } from 'vue'

// Mock useSectionTitles: getSectionTitle returns a recognizable string per key.
vi.mock('@cornflow-ui/core/composables/useSectionTitles', () => ({
  useSectionTitles: () => ({
    getSectionTitle: (key: string) => `TITLE:${key}`,
  }),
}))

import { useSectionDisplay } from '@cornflow-ui/core/composables/section-view/useSectionDisplay'

function setup(opts: {
  sectionType?: string
  isGroupView?: boolean
  groupName?: string
  tableConfig?: any
  tableKey?: string
  groupTables?: any
}) {
  return useSectionDisplay(
    ref(opts.sectionType ?? 'configuration'),
    ref(opts.isGroupView ?? false),
    ref(opts.groupName ?? ''),
    ref(opts.tableConfig ?? null),
    ref(opts.tableKey ?? ''),
    ref(opts.groupTables ?? {}),
  )
}

describe('useSectionDisplay', () => {
  test('getSectionDisplayName maps each section type', () => {
    expect(setup({ sectionType: 'configuration' }).getSectionDisplayName()).toBe(
      'TITLE:masterData',
    )
    expect(setup({ sectionType: 'input-data' }).getSectionDisplayName()).toBe(
      'TITLE:inputData',
    )
    expect(setup({ sectionType: 'results' }).getSectionDisplayName()).toBe(
      'TITLE:results',
    )
    // default branch
    expect(setup({ sectionType: 'something-else' }).getSectionDisplayName()).toBe(
      'TITLE:masterData',
    )
  })

  test('title capitalizes group name in group view', () => {
    const { title } = setup({ isGroupView: true, groupName: 'demand' })
    expect(title.value).toBe('Demand')
  })

  test('title uses tableConfig.title when not group view', () => {
    const { title } = setup({
      isGroupView: false,
      tableConfig: { title: 'My Table' },
      tableKey: 'fallbackKey',
    })
    expect(title.value).toBe('My Table')
  })

  test('title falls back to tableKey when no config title', () => {
    const { title } = setup({
      isGroupView: false,
      tableConfig: null,
      tableKey: 'fallbackKey',
    })
    expect(title.value).toBe('fallbackKey')
  })

  test('description combines section name and title', () => {
    const groupView = setup({
      sectionType: 'results',
      isGroupView: true,
      groupName: 'kpis',
    })
    expect(groupView.description.value).toBe('TITLE:results - Kpis')

    const single = setup({
      sectionType: 'input-data',
      isGroupView: false,
      tableConfig: { title: 'Orders' },
    })
    expect(single.description.value).toBe('TITLE:inputData - Orders')
  })

  test('currentIcon for group view uses first table icon', () => {
    const withIcon = setup({
      isGroupView: true,
      groupName: 'g',
      groupTables: { t1: { icon: 'mdi-star' }, t2: { icon: 'mdi-x' } },
    })
    expect(withIcon.currentIcon.value).toBe('mdi-star')

    // empty group -> default folder icon
    const empty = setup({ isGroupView: true, groupName: 'g', groupTables: {} })
    expect(empty.currentIcon.value).toBe('mdi-folder-table')

    // first table without icon -> default folder icon
    const noIcon = setup({
      isGroupView: true,
      groupName: 'g',
      groupTables: { t1: {} },
    })
    expect(noIcon.currentIcon.value).toBe('mdi-folder-table')
  })

  test('currentIcon for single table uses config icon or default', () => {
    const withIcon = setup({
      isGroupView: false,
      tableConfig: { icon: 'mdi-table-large' },
    })
    expect(withIcon.currentIcon.value).toBe('mdi-table-large')

    const noIcon = setup({ isGroupView: false, tableConfig: null })
    expect(noIcon.currentIcon.value).toBe('mdi-table')
  })
})
