import { describe, test, expect, vi, afterEach } from 'vitest'
import { createExecutionFlowComponent } from '@cornflow-ui/core/utils/createExecutionFlow'

describe('createExecutionFlowComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('gives no component when no flow is declared', () => {
    expect(createExecutionFlowComponent(null)).toBeNull()
    expect(createExecutionFlowComponent(undefined)).toBeNull()
  })

  test('turns a lazy import into a component that loads the view', () => {
    const loader = vi.fn(() =>
      Promise.resolve({ default: { name: 'OwnFlow' } }),
    )

    const component = createExecutionFlowComponent(loader) as Record<
      string,
      any
    >

    expect(component).not.toBeNull()
    expect(component.name).toBe('AsyncComponentWrapper')
    expect(loader).not.toHaveBeenCalled()
  })

  test('gives the same component every time for the same lazy import', () => {
    const loader = () => Promise.resolve({ name: 'OwnFlow' })
    const other = () => Promise.resolve({ name: 'OtherFlow' })

    expect(createExecutionFlowComponent(loader)).toBe(
      createExecutionFlowComponent(loader),
    )
    expect(createExecutionFlowComponent(other)).not.toBe(
      createExecutionFlowComponent(loader),
    )
  })

  test('ignores, with a warning, a flow that is not a lazy import', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(createExecutionFlowComponent({ name: 'OwnFlow' } as any)).toBeNull()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('createExecution.component'),
    )
  })
})
