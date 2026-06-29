import { describe, test, expect, afterEach } from 'vitest'
import {
  registerPremiumModules,
  applyPremiumExecutionTabDecorators,
} from '@/plugins/extensions'
import type { PremiumModule, ExecutionTab } from '@/types/extension'

const tabs: ExecutionTab[] = [
  { value: 1, text: 'A' },
  { value: 2, text: 'B' },
]

afterEach(() => {
  registerPremiumModules([])
})

describe('applyPremiumExecutionTabDecorators', () => {
  test('returns tabs unchanged when no modules are registered', () => {
    expect(applyPremiumExecutionTabDecorators(tabs)).toEqual(tabs)
  })

  test('applies each module decorator in chain and forwards routeName', () => {
    const seenRouteNames: (string | undefined)[] = []
    const mod: PremiumModule = {
      id: 'fake',
      decorateExecutionTabs: (input, ctx) => {
        seenRouteNames.push(ctx.routeName)
        return input.map((t) => ({ ...t, text: `*${t.text}` }))
      },
    }
    registerPremiumModules([mod])

    const out = applyPremiumExecutionTabDecorators(tabs, { routeName: 'Home' })
    expect(out.map((t) => t.text)).toEqual(['*A', '*B'])
    expect(seenRouteNames).toEqual(['Home'])
  })

  test('skips disabled modules', () => {
    const mod: PremiumModule = {
      id: 'disabled',
      isEnabled: () => false,
      decorateExecutionTabs: (input) =>
        input.map((t) => ({ ...t, text: 'X' })),
    }
    registerPremiumModules([mod])
    expect(applyPremiumExecutionTabDecorators(tabs)).toEqual(tabs)
  })
})
