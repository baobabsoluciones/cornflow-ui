import { describe, test, expect, beforeEach } from 'vitest'
import { rememberReturnTo, takeReturnTo } from '@cornflow-ui/core/utils/returnTo'

describe('return-to after a forced sign-in', () => {
  beforeEach(() => sessionStorage.clear())

  test('gives back the page with its query and hash, once', () => {
    rememberReturnTo('/results/tableA?page=3&q=x#row-9')
    expect(takeReturnTo()).toBe('/results/tableA?page=3&q=x#row-9')
    expect(takeReturnTo()).toBeNull()
  })

  test.each([
    'https://evil.example/phish',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    'javascript:alert(1)',
    'history-execution',
    '',
  ])('does not accept %j', (target) => {
    rememberReturnTo(target)
    expect(takeReturnTo()).toBeNull()
  })

  test('a tampered value in storage is not followed either', () => {
    sessionStorage.setItem('returnTo', 'https://evil.example')
    expect(takeReturnTo()).toBeNull()
  })

  test.each(['/sign-in', '/sign-in?expired=true', '/sign-out', '/logout'])('ignores the %s route', (route) => {
    rememberReturnTo(route)
    expect(takeReturnTo()).toBeNull()
  })

  test('an ignored route does not erase the page already remembered', () => {
    rememberReturnTo('/dashboard')
    rememberReturnTo('/sign-in?expired=true')
    expect(takeReturnTo()).toBe('/dashboard')
  })
})
