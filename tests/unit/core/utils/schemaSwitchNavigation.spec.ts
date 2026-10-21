import { describe, test, expect, vi } from 'vitest'
import { isRouteAvailableAfterSchemaSwitch } from '@cornflow-ui/core/utils/schemaSwitchNavigation'

const subsections = vi.hoisted(() => ({
  pricing: [
    { path: 'board', name: 'Board', titleKey: 'board', icon: 'mdi-view', component: vi.fn() },
    {
      path: 'planning-only',
      name: 'PlanningOnly',
      titleKey: 'planningOnly',
      icon: 'mdi-view',
      component: vi.fn(),
      schemas: ['planning_dag'],
    },
  ],
}))

vi.mock('@/app/config', () => ({
  default: {
    getInstanceDependentAppRoutePrefixes: () => ['/execution-report'],
    getFrontendAutomationSubsectionDef: (sectionId: string, path: string) =>
      (subsections as Record<string, Array<{ path: string }>>)[sectionId]?.find(
        (def) => def.path === path,
      ) ?? null,
  },
}))

/** Master-data tables of the DAG the session switched to. */
const masterData = {
  prices: { title: 'Prices', group: null, section: 'pricing' },
  plants: { title: 'Plants', group: 'Sites', section: null },
} as any

const viewer = { roleNames: ['planner'], schema: 'stock_dag' }

describe('isRouteAvailableAfterSchemaSwitch', () => {
  test('keeps views that do not depend on the DAG', () => {
    for (const path of ['/history-execution', '/project-execution', '/user-settings']) {
      expect(isRouteAvailableAfterSchemaSwitch({ path }, masterData, viewer)).toBe(true)
    }
  })

  test('leaves the views of the selected execution, which the switch closes', () => {
    for (const path of ['/input-data/t_in', '/results/t_out', '/dashboard', '/execution-report']) {
      expect(isRouteAvailableAfterSchemaSwitch({ path }, masterData, viewer)).toBe(false)
    }
  })

  test('leaves a route gated to other DAGs or roles, and keeps one that lets the viewer in', () => {
    const gatedTo = (meta: Record<string, unknown>) => ({
      path: '/board',
      matched: [{ meta: {} }, { meta }],
    })

    expect(
      isRouteAvailableAfterSchemaSwitch(gatedTo({ schemas: ['planning_dag'] }), masterData, viewer),
    ).toBe(false)
    expect(
      isRouteAvailableAfterSchemaSwitch(gatedTo({ roles: ['admin'] }), masterData, viewer),
    ).toBe(false)
    expect(
      isRouteAvailableAfterSchemaSwitch(gatedTo({ schemas: ['stock_dag'] }), masterData, viewer),
    ).toBe(true)
  })

  test('keeps a master-data table or group the new DAG has, and leaves one it lacks', () => {
    const available = (path: string) =>
      isRouteAvailableAfterSchemaSwitch({ path }, masterData, viewer)

    expect(available('/configuration/prices')).toBe(true)
    expect(available('/configuration/group/sites')).toBe(true)
    expect(available('/configuration/group/sites/plants')).toBe(true)
    expect(available('/configuration/stock_levels')).toBe(false)
  })

  test('keeps a section sub-section whose section the new DAG has and that is not gated out', () => {
    const subsection = (sectionId: string, subsectionKey: string) => ({
      path: `/configuration/section/${sectionId}/${subsectionKey}`,
      params: { sectionId, subsectionKey },
    })

    expect(
      isRouteAvailableAfterSchemaSwitch(subsection('pricing', 'board'), masterData, viewer),
    ).toBe(true)
    expect(
      isRouteAvailableAfterSchemaSwitch(subsection('pricing', 'planning-only'), masterData, viewer),
    ).toBe(false)
    expect(
      isRouteAvailableAfterSchemaSwitch(subsection('logistics', 'board'), masterData, viewer),
    ).toBe(false)
  })
})
