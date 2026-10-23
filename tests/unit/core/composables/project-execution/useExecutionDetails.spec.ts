import { describe, test, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

const { store } = vi.hoisted(() => ({
  store: {
    appConfig: { parameters: {} as Record<string, any> },
    fetchTableOptions: vi.fn(),
  },
}))
vi.mock('@cornflow-ui/core/stores/general', () => ({
  useGeneralStore: () => store,
}))

import {
  formatDuration,
  useExecutionDetails,
} from '@cornflow-ui/core/composables/project-execution/useExecutionDetails'
import { useExecutionStatus } from '@cornflow-ui/core/composables/project-execution/useExecutionStatus'

const STATES = {
  executionStates: {
    '1': {
      color: 'green',
      codeKey: 'state.success',
      messageKey: 'state.successMessage',
    },
    '0': {
      color: 'purple',
      codeKey: 'state.running',
      messageKey: 'state.runningMessage',
    },
    '-7': {
      color: 'red',
      codeKey: 'state.queued',
      messageKey: 'state.queuedMessage',
    },
    '-1': {
      color: 'red',
      codeKey: 'state.error',
      messageKey: 'state.errorMessage',
    },
    '-3': {
      color: 'red',
      codeKey: 'state.error',
      messageKey: 'state.notStartedMessage',
    },
    '-4': {
      color: 'orange',
      codeKey: 'state.notRun',
      messageKey: 'state.notRunMessage',
      icon: 'mdi-cancel',
    },
  },
  solutionStates: {
    1: {
      color: 'green',
      codeKey: 'state.optimal',
      messageKey: 'state.optimalMessage',
    },
    5: {
      color: 'orange',
      codeKey: 'state.timeLimit',
      messageKey: 'state.timeLimitMessage',
    },
  },
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {
      state: {
        success: 'Success',
        successMessage: 'Solved',
        running: 'Running',
        runningMessage: 'It is running',
        queued: 'Queued',
        queuedMessage: 'Waiting for a worker',
        error: 'Error',
        errorMessage: 'It failed',
        notStartedMessage: 'It did not start',
        notRun: 'Not run',
        notRunMessage: 'Not run by the user',
        optimal: 'Optimal',
        optimalMessage: 'Best solution',
        timeLimit: 'Time limit',
        timeLimitMessage: 'Stopped at the limit',
      },
      fields: {
        horizon: 'Horizon',
        mode: 'Mode',
        plant: 'Plant',
        start: 'Start',
      },
      days: 'days',
      operative: 'Operative',
      configParams: { minutesSuffix: 'min', secondsSuffix: 'sec' },
      versionHistory: {
        detail: {
          user: 'User',
          created: 'Created',
          finished: 'Finished',
          duration: 'Duration',
          inProgress: 'in progress',
          solver: 'Solver',
          timeLimit: 'Time limit',
          yes: 'Yes',
          no: 'No',
        },
        timeline: {
          queued: 'Queued',
          running: 'Running',
          execution: 'Execution',
          finished: 'Finished',
          waiting: 'Waiting · {time}',
          pending: 'Pending',
          created: 'Created',
          took: 'Took {time}',
          elapsedOf: '{elapsed} of {limit}',
          limitUsed: 'Time used',
          notStarted: 'Could not start',
        },
      },
    },
  },
})

/** Runs the composables inside a component, as a view would. */
function setup() {
  let result: ReturnType<typeof useExecutionDetails> &
    ReturnType<typeof useExecutionStatus>
  mount(
    defineComponent({
      setup() {
        result = { ...useExecutionDetails(), ...useExecutionStatus() }
        return () => h('div')
      },
    }),
    { global: { plugins: [i18n] } },
  )
  return result!
}

const CREATED = '2026-10-21T10:30:00Z'
const created = new Date(CREATED).getTime()

const execution = (overrides = {}) => ({
  id: 'e1',
  name: 'Plan week 43',
  state: 1,
  createdAt: CREATED,
  finishedAt: '2026-10-21T10:41:20Z',
  userName: 'agarcia',
  userFullName: 'Ana García',
  config: { solver: 'mip_solver', timeLimit: 900 },
  ...overrides,
})

beforeEach(() => {
  store.appConfig = reactive({
    parameters: {
      ...STATES,
      showExtraProjectExecutionColumns: {
        showUserFullName: true,
        showEndCreationDate: true,
        showTimeLimit: true,
        showSolver: true,
      },
      configFieldsConfig: { showConfigFieldsStep: true },
      configFields: [
        { key: 'timeLimit', title: 'configParams.timeLimit', type: 'number' },
        {
          key: 'horizon',
          title: 'fields.horizon',
          type: 'number',
          suffix: 'days',
        },
        {
          key: 'mode',
          title: 'fields.mode',
          options: [{ value: 'op', label: 'operative' }],
        },
        { key: 'plant', title: 'fields.plant', joinFrom: 'plants.name' },
        { key: 'night', title: 'Night shift' },
      ],
    },
  })
  store.fetchTableOptions.mockReset()
})

describe('formatDuration', () => {
  test('uses seconds, minutes and hours as the time grows', () => {
    expect(formatDuration(42)).toBe('42 s')
    expect(formatDuration(724)).toBe('12 min 04 s')
    expect(formatDuration(3900)).toBe('1 h 05 min')
    expect(formatDuration(-5)).toBe('0 s')
  })
})

describe('useExecutionStatus', () => {
  test('takes the label, message and tone of the state from the config', () => {
    const { executionStatus, solutionStatus } = setup()

    expect(executionStatus(1)).toMatchObject({
      label: 'Success',
      message: 'Solved',
      tone: 'success',
      icon: 'mdi-check-circle',
    })
    expect(executionStatus(-1)).toMatchObject({
      tone: 'danger',
      icon: 'mdi-alert-circle',
    })
    expect(solutionStatus(5)).toMatchObject({
      label: 'Time limit',
      tone: 'warning',
    })
  })

  test('running and queued look the same in every app', () => {
    const { executionStatus } = setup()

    expect(executionStatus(0)).toMatchObject({
      tone: 'primary',
      icon: 'mdi-loading',
      spin: true,
    })
    expect(executionStatus(-7)).toMatchObject({
      tone: 'neutral',
      icon: 'mdi-clock-outline',
    })
  })

  test('a state can name its own icon', () => {
    const { executionStatus } = setup()
    expect(executionStatus(-4).icon).toBe('mdi-cancel')
  })

  test('an unknown state is neutral', () => {
    const { executionStatus, solutionStatus } = setup()
    expect(executionStatus(99).tone).toBe('neutral')
    expect(solutionStatus(null).tone).toBe('neutral')
  })
})

describe('useExecutionDetails — data', () => {
  test('lists user, dates, duration, solver and time limit as the app shows them', () => {
    const { dataItems } = setup()
    const items = dataItems(execution(), created)

    expect(items.map((item) => item.label)).toEqual([
      'User',
      'Created',
      'Finished',
      'Duration',
      'Solver',
      'Time limit',
    ])
    expect(items[0].value).toBe('Ana García')
    expect(items[3].value).toBe('11 min 20 s')
    expect(items[4].value).toBe('mip_solver')
    expect(items[5].value).toBe('900 sec')
  })

  test('a time limit in minutes shows as minutes and counts as minutes in the progress', () => {
    store.appConfig.parameters.configFields = [
      { key: 'timeLimit', minutes: true },
    ]
    const { dataItems, timelineSteps } = setup()
    const running = execution({
      state: 0,
      finishedAt: null,
      config: { timeLimit: 10 },
    })

    expect(
      dataItems(execution({ config: { timeLimit: 10 } }), created).at(-1)
        ?.value,
    ).toBe('10 min')
    expect(timelineSteps(running, created + 300_000)[1].progress).toBe(50)
  })

  test('leaves out what the app does not show', () => {
    store.appConfig.parameters.showExtraProjectExecutionColumns = {
      showSolver: false,
    }
    const { dataItems } = setup()

    expect(dataItems(execution(), created).map((item) => item.label)).toEqual([
      'Created',
      'Duration',
    ])
  })

  test('a running execution has no end yet and a live duration', () => {
    const { dataItems } = setup()
    const items = dataItems(
      execution({ state: 0, finishedAt: null }),
      created + 75_000,
    )

    expect(items.find((item) => item.label === 'Finished')).toMatchObject({
      value: '—',
      muted: true,
    })
    expect(items.find((item) => item.label === 'Duration')?.value).toBe(
      '1 min 15 s · in progress',
    )
  })
})

describe('useExecutionDetails — parameters', () => {
  test('names each parameter and its value as the parameters step does', async () => {
    store.fetchTableOptions.mockResolvedValue([
      { value: 2, title: 'South plant' },
    ])
    const { parameterItems, loadParameterOptions } = setup()
    await loadParameterOptions()
    await flushPromises()

    expect(store.fetchTableOptions).toHaveBeenCalledWith('plants.name')
    expect(
      parameterItems(
        execution({
          config: {
            timeLimit: 900,
            horizon: 7,
            mode: 'op',
            plant: 2,
            night: false,
          },
        }),
      ),
    ).toEqual([
      { label: 'Horizon', value: '7 days' },
      { label: 'Mode', value: 'Operative' },
      { label: 'Plant', value: 'South plant' },
      { label: 'Night shift', value: 'No' },
    ])
  })

  test('leaves out the parameters the execution did not set', () => {
    const { parameterItems } = setup()
    expect(parameterItems(execution({ config: { horizon: '' } }))).toEqual([])
  })
})

describe('useExecutionDetails — progress', () => {
  test('a queued execution is waiting', () => {
    const { timelineSteps } = setup()
    const steps = timelineSteps(
      execution({ state: -7, finishedAt: null }),
      created + 12_000,
    )

    expect(steps.map((step) => step.status)).toEqual([
      'current',
      'pending',
      'pending',
    ])
    expect(steps[0].description).toBe('Waiting · 12 s')
  })

  test('a running execution shows how much of its time limit it used', () => {
    const { timelineSteps } = setup()
    const steps = timelineSteps(
      execution({ state: 0, finishedAt: null }),
      created + 450_000,
    )

    expect(steps.map((step) => step.status)).toEqual([
      'done',
      'current',
      'pending',
    ])
    expect(steps[1]).toMatchObject({
      description: '7 min 30 s of 15 min 00 s',
      progress: 50,
      spin: true,
    })
  })

  test('a finished execution ends with its state and how long it took', () => {
    const { timelineSteps } = setup()
    const steps = timelineSteps(execution(), created)

    expect(steps[1]).toMatchObject({
      status: 'done',
      description: 'Took 11 min 20 s',
    })
    expect(steps[2]).toMatchObject({
      label: 'Success',
      description: 'Solved',
      tone: 'success',
    })
  })

  test('an execution that could not start fails at the run step', () => {
    const { timelineSteps } = setup()
    const steps = timelineSteps(execution({ state: -3 }), created)

    expect(steps[1]).toMatchObject({
      status: 'failed',
      description: 'Could not start',
    })
  })

  test('an execution the user did not run skips the run step', () => {
    const { timelineSteps } = setup()
    expect(timelineSteps(execution({ state: -4 }), created)[1]).toMatchObject({
      status: 'skipped',
      description: 'Not run by the user',
    })
  })
})
