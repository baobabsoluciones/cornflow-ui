import { describe, test, expect, vi, beforeEach } from 'vitest'

/**
 * Covers useMasterTableMatch — the diff engine and choice/apply machinery:
 *  - getMasterCompareRowContext (exported)
 *  - calculateDiffSummary (empty / one-sided / full compare branches)
 *  - detectMatches (guards, array tables, parameter-object tables, no master)
 *  - getDetailedDiff (added / removed / modified / identical)
 *  - setUserChoice, updateMatchAfterAction (use_master / replace_master)
 *  - applyChoices (use_master, replace_master, onlyTableKey filter, error)
 *  - canReplaceMasterTable, computeds, reset, force-retry accept/reject
 *
 * schemaUtils is mocked with light but faithful implementations so the real
 * diff branching runs. TableRepository, app config, store and i18n are mocked.
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockT = vi.fn((key: string) => key)
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: mockT, locale: { value: 'en' } }),
}))

// ── app config: drives ETL-prefiltered baseline + compare strategies ──
const cfg = vi.hoisted(() => ({
  enableEtlMetadataAndReview: false,
  compareStrategies: {} as Record<string, any>,
}))
vi.mock('@/app/config', () => ({
  default: {
    getCore: () => ({
      parameters: {
        etl: {
          get enableEtlMetadataAndReview() {
            return cfg.enableEtlMetadataAndReview
          },
        },
        masterTableMatchingConfig: {
          get compareStrategies() {
            return cfg.compareStrategies
          },
        },
      },
    }),
  },
}))

// ── TableRepository ──
const repoCtrl = vi.hoisted(() => ({
  getListResult: [] as any[],
  getListThrows: false,
  overwriteThrows: null as null | 'force' | 'other',
}))
const overwriteAllSpy = vi.fn()
const getListSpy = vi.fn()

class FakeForceRetryError extends Error {
  __forceRetry = true
}

vi.mock('@cornflow-ui/core/repositories/TableRepository', () => {
  return {
    isForceRetryOfferError: (e: any) => e instanceof FakeForceRetryError,
    default: class FakeTableRepository {
      cfg: any
      constructor(cfg: any) {
        this.cfg = cfg
      }
      async getList() {
        getListSpy(this.cfg)
        if (repoCtrl.getListThrows) throw new Error('getList-boom')
        return repoCtrl.getListResult
      }
      async overwriteAll(data: any[], options?: any) {
        overwriteAllSpy(data, options)
        if (repoCtrl.overwriteThrows === 'force') {
          throw new FakeForceRetryError('force offered')
        }
        if (repoCtrl.overwriteThrows === 'other') {
          throw new Error('overwrite-boom')
        }
        return true
      }
    },
  }
})

// ── schemaUtils: light implementations preserving the real diff semantics ──
vi.mock('@cornflow-ui/core/utils/schemaUtils', () => ({
  parseJoinFrom: () => null,
  getForeignKeyFieldName: () => undefined,
  getExcludedKeysForMasterTableCompare: () => new Set(['id', '_id']),
  resolveMatchKeyFields: (inst: any[], master: any[], matchFields?: string[]) =>
    matchFields ?? ['id'],
  buildRowMatchKey: (row: any, keyFields: string[]) =>
    keyFields.map((f) => String(row?.[f])).join('|'),
  applyMasterTableDisplayNormalization: (rows: any[]) => rows,
  getListResponseRowProperties: () => undefined,
  normalizeGetListResponseToRows: (data: any) => (Array.isArray(data) ? data : []),
  isParameterTableAutomationConfig: (cfg: any) => !!cfg?.isParameterObject,
  isParameterTableSchema: () => false,
  getInstanceSchemaRootForTables: () => ({ properties: {} }),
  filterParameterObjectByVisibleProperties: (obj: any) => obj,
  normalizeMasterListToParameterRows: (rows: any[]) => rows,
  parameterRowsToParameterObject: (rows: any[]) =>
    Object.fromEntries(rows.map((r: any) => [r.parameter, r.value])),
  getInstanceTableSchemaColumns: () => undefined,
  buildLowercasedKeyMap: (row: any) => {
    const m = new Map<string, any>()
    if (row && typeof row === 'object') {
      for (const k of Object.keys(row)) m.set(k.toLowerCase(), row[k])
    }
    return m
  },
  resolveComparableLowercasedKeys: ({ row1, row2, allowedColumns, excludedKeys }: any) => {
    const keys = new Set<string>()
    const add = (r: any) => {
      if (r && typeof r === 'object') {
        for (const k of Object.keys(r)) {
          const lower = k.toLowerCase()
          if (excludedKeys?.has(lower)) continue
          if (allowedColumns && !allowedColumns.map((c: string) => c.toLowerCase()).includes(lower))
            continue
          keys.add(lower)
        }
      }
    }
    add(row1)
    add(row2)
    return Array.from(keys)
  },
  getMasterJoinedDisplayColumns: () => [],
}))

// ── store ──
const store = vi.hoisted(() => ({
  getConfigurations: { masterData: {} as Record<string, any> },
  rawConfigurations: { masterData: {} as Record<string, any> },
  schemaConfig: { instanceSchema: { properties: {} } },
}))
vi.mock('@cornflow-ui/core/stores/general', () => ({
  useGeneralStore: () => store,
}))

import {
  useMasterTableMatch,
  getMasterCompareRowContext,
  type TableMatch,
} from '@cornflow-ui/core/composables/project-execution/useMasterTableMatch'

// ─── Helpers ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  cfg.enableEtlMetadataAndReview = false
  cfg.compareStrategies = {}
  repoCtrl.getListResult = []
  repoCtrl.getListThrows = false
  repoCtrl.overwriteThrows = null
  store.getConfigurations = { masterData: {} }
  store.rawConfigurations = { masterData: {} }
  store.schemaConfig = { instanceSchema: { properties: {} } }
})

function masterCfg(overrides: any = {}) {
  return { title: 'Master', overwrite_all: true, ...overrides }
}

// ─── getMasterCompareRowContext (exported) ──────────────────────────────────────

describe('getMasterCompareRowContext', () => {
  test('builds normalized maps keyed by match key (no dictionaries)', () => {
    const inst = [{ id: 1, v: 'a' }]
    const master = [{ id: 1, v: 'b' }]
    const { keyFields, normInstByKey, normMasterByKey } =
      getMasterCompareRowContext(inst, master, 'tbl', undefined)

    expect(keyFields).toEqual(['id'])
    expect(normInstByKey.get('1')).toEqual({ id: 1, v: 'a' })
    expect(normMasterByKey.get('1')).toEqual({ id: 1, v: 'b' })
  })

  test('uses configured matchFields from the compare strategy', () => {
    cfg.compareStrategies = { tbl: { matchFields: ['name'] } }
    const { keyFields } = getMasterCompareRowContext(
      [{ name: 'x' }],
      [{ name: 'x' }],
      'tbl',
      undefined,
    )
    expect(keyFields).toEqual(['name'])
  })
})

// ─── calculateDiffSummary ──────────────────────────────────────────────────────

describe('useMasterTableMatch.calculateDiffSummary', () => {
  test('empty instance → everything counts as onlyInMaster', () => {
    const { calculateDiffSummary } = useMasterTableMatch()
    const summary = calculateDiffSummary([], [{ id: 1 }, { id: 2 }], masterCfg())
    expect(summary).toMatchObject({
      onlyInInstance: 0,
      onlyInMaster: 2,
      totalInstance: 0,
      totalMaster: 2,
    })
  })

  test('empty master → everything counts as onlyInInstance', () => {
    const { calculateDiffSummary } = useMasterTableMatch()
    const summary = calculateDiffSummary([{ id: 1 }], [], masterCfg())
    expect(summary).toMatchObject({ onlyInInstance: 1, onlyInMaster: 0, totalMaster: 0 })
  })

  test('classifies identical, different, added and removed rows', () => {
    const { calculateDiffSummary } = useMasterTableMatch()
    const inst = [
      { id: 1, v: 'same' },
      { id: 2, v: 'changed' },
      { id: 3, v: 'newrow' },
    ]
    const master = [
      { id: 1, v: 'same' },
      { id: 2, v: 'old' },
      { id: 4, v: 'gone' },
    ]
    const summary = calculateDiffSummary(inst, master, masterCfg())
    expect(summary).toMatchObject({
      identical: 1,
      different: 1,
      onlyInInstance: 1,
      onlyInMaster: 1,
      totalInstance: 3,
      totalMaster: 3,
    })
  })

  test('treats coerced string/number and empty/null as equal (normalizeValue)', () => {
    const { calculateDiffSummary } = useMasterTableMatch()
    const inst = [{ id: 1, n: '42', blank: '' }]
    const master = [{ id: 1, n: 42, blank: null }]
    const summary = calculateDiffSummary(inst, master, masterCfg())
    expect(summary.identical).toBe(1)
    expect(summary.different).toBe(0)
  })
})

// ─── detectMatches ──────────────────────────────────────────────────────────────

describe('useMasterTableMatch.detectMatches', () => {
  test('clears matches for non-object instance data', async () => {
    const m = useMasterTableMatch()
    await m.detectMatches(null as any)
    expect(m.matches.value).toEqual([])
    expect(m.hasMatches.value).toBe(false)
  })

  test('clears matches when there is no master catalog', async () => {
    store.rawConfigurations = { masterData: {} }
    store.getConfigurations = { masterData: {} }
    const m = useMasterTableMatch()
    await m.detectMatches({ table_a: [{ id: 1 }] })
    expect(m.matches.value).toEqual([])
  })

  test('matches an array instance table to its master config', async () => {
    store.rawConfigurations = { masterData: { table_a: masterCfg() } }
    repoCtrl.getListResult = [{ id: 1, v: 'old' }]

    const m = useMasterTableMatch()
    await m.detectMatches({ table_a: [{ id: 1, v: 'new' }] })

    expect(m.matches.value).toHaveLength(1)
    const match = m.matches.value[0]
    expect(match.tableKey).toBe('table_a')
    expect(match.storageShape).toBe('array_table')
    expect(match.hasDifferences).toBe(true)
    expect(m.matchesWithDifferences.value).toHaveLength(1)
    expect(getListSpy).toHaveBeenCalled()
  })

  test('skips instance tables prefixed with __', async () => {
    store.rawConfigurations = { masterData: { table_a: masterCfg() } }
    const m = useMasterTableMatch()
    await m.detectMatches({ __metadata__: { x: 1 }, nomaster: [{ id: 1 }] })
    expect(m.matches.value).toEqual([])
  })

  test('handles a parameter-object instance table', async () => {
    store.rawConfigurations = {
      masterData: { params: masterCfg({ isParameterObject: true }) },
    }
    repoCtrl.getListResult = [{ parameter: 'a', value: 1 }]

    const m = useMasterTableMatch()
    await m.detectMatches({ params: { a: 1, b: 2 } })

    expect(m.matches.value).toHaveLength(1)
    expect(m.matches.value[0].storageShape).toBe('parameter_object')
  })

  test('uses the frozen ETL prefiltered baseline when enabled', async () => {
    cfg.enableEtlMetadataAndReview = true
    store.rawConfigurations = { masterData: { table_a: masterCfg() } }

    const m = useMasterTableMatch()
    await m.detectMatches(
      { table_a: [{ id: 1, v: 'x' }] },
      { etlTablesFromDb: ['table_a'] },
    )

    // master data comes from the snapshot (== instance rows), so no repo call
    expect(getListSpy).not.toHaveBeenCalled()
    expect(m.matches.value[0].masterData).toHaveLength(1)
    expect(Object.isFrozen(m.matches.value[0].masterData)).toBe(true)
  })
})

// ─── getDetailedDiff ─────────────────────────────────────────────────────────────

describe('useMasterTableMatch.getDetailedDiff', () => {
  async function setup() {
    store.rawConfigurations = { masterData: { table_a: masterCfg() } }
    repoCtrl.getListResult = [
      { id: 1, v: 'same' },
      { id: 2, v: 'old' },
      { id: 4, v: 'removed' },
    ]
    const m = useMasterTableMatch()
    await m.detectMatches({
      table_a: [
        { id: 1, v: 'same' },
        { id: 2, v: 'new' },
        { id: 3, v: 'added' },
      ],
    })
    return m
  }

  test('returns added / modified / identical / removed entries', async () => {
    const m = await setup()
    const diffs = m.getDetailedDiff('table_a')
    const byType = (t: string) => diffs.filter((d) => d.type === t)

    expect(byType('identical')).toHaveLength(1)
    expect(byType('added')).toHaveLength(1)
    expect(byType('removed')).toHaveLength(1)
    const modified = byType('modified')
    expect(modified).toHaveLength(1)
    expect(modified[0].changes).toEqual([
      { field: 'v', instanceValue: 'new', masterValue: 'old' },
    ])
  })

  test('returns [] for an unknown table key', async () => {
    const m = await setup()
    expect(m.getDetailedDiff('does-not-exist')).toEqual([])
  })
})

// ─── setUserChoice / allChoicesMade ──────────────────────────────────────────────

describe('useMasterTableMatch.setUserChoice & computeds', () => {
  async function withOneMatch() {
    store.rawConfigurations = { masterData: { table_a: masterCfg() } }
    repoCtrl.getListResult = [{ id: 1, v: 'old' }]
    const m = useMasterTableMatch()
    await m.detectMatches({ table_a: [{ id: 1, v: 'new' }] })
    return m
  }

  test('allChoicesMade flips to true once every match has a choice', async () => {
    const m = await withOneMatch()
    expect(m.allChoicesMade.value).toBe(false)
    m.setUserChoice('table_a', 'keep_uploaded')
    expect(m.matches.value[0].userChoice).toBe('keep_uploaded')
    expect(m.allChoicesMade.value).toBe(true)
  })

  test('setUserChoice on an unknown key is a no-op', async () => {
    const m = await withOneMatch()
    m.setUserChoice('unknown', 'use_master')
    expect(m.matches.value[0].userChoice).toBeNull()
  })

  test('canReplaceMasterTable reflects overwrite_all and storage shape', async () => {
    const m = await withOneMatch()
    expect(m.canReplaceMasterTable('table_a')).toBe(true)
    expect(m.canReplaceMasterTable('missing')).toBe(false)
  })
})

// ─── updateMatchAfterAction ─────────────────────────────────────────────────────

describe('useMasterTableMatch.updateMatchAfterAction', () => {
  async function withOneMatch() {
    store.rawConfigurations = { masterData: { table_a: masterCfg() } }
    repoCtrl.getListResult = [{ id: 1, v: 'old' }]
    const m = useMasterTableMatch()
    await m.detectMatches({ table_a: [{ id: 1, v: 'new' }] })
    return m
  }

  test('use_master replaces instance data and clears differences', async () => {
    const m = await withOneMatch()
    const master = m.matches.value[0].masterData
    m.updateMatchAfterAction('table_a', 'use_master', [...master])
    expect(m.matches.value[0].hasDifferences).toBe(false)
  })

  test('replace_master copies instance into master and clears differences', async () => {
    const m = await withOneMatch()
    m.updateMatchAfterAction('table_a', 'replace_master')
    expect(m.matches.value[0].hasDifferences).toBe(false)
    expect(m.matches.value[0].masterData).toEqual(m.matches.value[0].instanceData)
  })

  test('is a no-op for unknown table keys', async () => {
    const m = await withOneMatch()
    const before = m.matches.value[0]
    m.updateMatchAfterAction('nope', 'use_master', [])
    expect(m.matches.value[0]).toBe(before)
  })
})

// ─── applyChoices ────────────────────────────────────────────────────────────────

describe('useMasterTableMatch.applyChoices', () => {
  async function withTwoMatches() {
    store.rawConfigurations = {
      masterData: { table_a: masterCfg(), table_b: masterCfg() },
    }
    repoCtrl.getListResult = [{ id: 1, v: 'old' }]
    const m = useMasterTableMatch()
    await m.detectMatches({
      table_a: [{ id: 1, v: 'new' }],
      table_b: [{ id: 1, v: 'new' }],
    })
    return m
  }

  test('use_master copies master rows into the modified instance data', async () => {
    const m = await withTwoMatches()
    m.setUserChoice('table_a', 'use_master')
    m.setUserChoice('table_b', 'keep_uploaded')

    const { instanceData, masterTablesUpdated } = await m.applyChoices({
      table_a: [{ id: 1, v: 'new' }],
      table_b: [{ id: 1, v: 'new' }],
    })

    expect(instanceData.table_a).toEqual([{ id: 1, v: 'old' }])
    expect(masterTablesUpdated).toEqual([])
  })

  test('replace_master overwrites master via the repository', async () => {
    const m = await withTwoMatches()
    m.setUserChoice('table_a', 'replace_master')
    m.setUserChoice('table_b', 'keep_uploaded')

    const { masterTablesUpdated } = await m.applyChoices({
      table_a: [{ id: 1, v: 'new' }],
      table_b: [{ id: 1, v: 'new' }],
    })

    expect(overwriteAllSpy).toHaveBeenCalledTimes(1)
    expect(masterTablesUpdated).toContain('table_a')
  })

  test('onlyTableKey processes a single match', async () => {
    const m = await withTwoMatches()
    m.setUserChoice('table_a', 'replace_master')
    m.setUserChoice('table_b', 'replace_master')

    await m.applyChoices(
      { table_a: [], table_b: [] },
      { onlyTableKey: 'table_a' },
    )

    expect(overwriteAllSpy).toHaveBeenCalledTimes(1)
  })

  test('wraps a non-force overwrite error in a friendly message', async () => {
    repoCtrl.overwriteThrows = 'other'
    const m = await withTwoMatches()
    m.setUserChoice('table_a', 'replace_master')
    m.setUserChoice('table_b', 'keep_uploaded')

    await expect(
      m.applyChoices({ table_a: [], table_b: [] }),
    ).rejects.toThrow(/failedToUpdateMasterTable/)
  })
})

// ─── force-retry flow ────────────────────────────────────────────────────────────

describe('useMasterTableMatch - force retry offer', () => {
  async function withForceOffer() {
    repoCtrl.overwriteThrows = 'force'
    store.rawConfigurations = { masterData: { table_a: masterCfg() } }
    repoCtrl.getListResult = [{ id: 1, v: 'old' }]
    const m = useMasterTableMatch()
    await m.detectMatches({ table_a: [{ id: 1, v: 'new' }] })
    m.setUserChoice('table_a', 'replace_master')
    await expect(
      m.applyChoices({ table_a: [{ id: 1, v: 'new' }] }),
    ).rejects.toBeInstanceOf(Error)
    return m
  }

  test('replace failure with force offer populates forceRetryOffer', async () => {
    const m = await withForceOffer()
    expect(m.forceRetryOffer.value).not.toBeNull()
    expect(m.forceRetryOffer.value?.match.tableKey).toBe('table_a')
  })

  test('acceptForceRetry retries with force=true and clears the offer', async () => {
    const m = await withForceOffer()
    repoCtrl.overwriteThrows = null // retry succeeds
    const ok = await m.acceptForceRetry()
    expect(ok).toBe(true)
    expect(overwriteAllSpy).toHaveBeenLastCalledWith(expect.anything(), {
      force: true,
    })
    expect(m.forceRetryOffer.value).toBeNull()
  })

  test('acceptForceRetry returns false when no offer is pending', async () => {
    const m = useMasterTableMatch()
    expect(await m.acceptForceRetry()).toBe(false)
  })

  test('rejectForceRetry clears the pending offer', async () => {
    const m = await withForceOffer()
    m.rejectForceRetry()
    expect(m.forceRetryOffer.value).toBeNull()
  })
})

// ─── reset & error handling ──────────────────────────────────────────────────────

describe('useMasterTableMatch.reset & errors', () => {
  test('reset clears matches, caches, error and loading', async () => {
    store.rawConfigurations = { masterData: { table_a: masterCfg() } }
    repoCtrl.getListResult = [{ id: 1 }]
    const m = useMasterTableMatch()
    await m.detectMatches({ table_a: [{ id: 1 }] })
    expect(m.matches.value.length).toBeGreaterThan(0)

    m.reset()

    expect(m.matches.value).toEqual([])
    expect(m.error.value).toBeNull()
    expect(m.loading.value).toBe(false)
    expect(m.forceRetryOffer.value).toBeNull()
  })

  test('loadMasterData failure during detect yields empty master (caught)', async () => {
    repoCtrl.getListThrows = true
    store.rawConfigurations = { masterData: { table_a: masterCfg() } }
    const m = useMasterTableMatch()
    await m.detectMatches({ table_a: [{ id: 1, v: 'new' }] })

    // getList rejection is swallowed → master treated as empty, match still created
    expect(m.matches.value).toHaveLength(1)
    expect(m.matches.value[0].masterData).toEqual([])
  })
})
