import { describe, test, expect } from 'vitest'
import {
  PASSWORD_MIN_LENGTH,
  loadStrengthScorer,
  passwordChecks,
} from '@cornflow-ui/core/utils/passwordPolicy'

const met = (password: string, score?: (p: string) => number) =>
  Object.fromEntries(passwordChecks(password, score).map((check) => [check.key, check.met]))

describe('password policy', () => {
  test(`asks for at least ${PASSWORD_MIN_LENGTH} characters`, () => {
    expect(met('Ab1!efghijk').length).toBe(false)
    expect(met('Ab1!efghijkl').length).toBe(true)
  })

  test('asks for upper and lower case letters, a digit and a special character', () => {
    expect(met('abcdefghijk1!').characters).toBe(false)
    expect(met('ABCDEFGHIJK1!').characters).toBe(false)
    expect(met('Abcdefghijkl!').characters).toBe(false)
    expect(met('Abcdefghijk12').characters).toBe(false)
    expect(met('Abcdefghijk1!').characters).toBe(true)
  })

  test('refuses spaces', () => {
    expect(met('Abc defghij1!').spaces).toBe(false)
    expect(met('Abcdefghij1!').spaces).toBe(true)
  })

  test('refuses runs of 6 or more digits, such as dates', () => {
    expect(met('Report-20261123').digits).toBe(false)
    expect(met('Report-2026-11-23').digits).toBe(true)
  })

  test('an empty password meets nothing', () => {
    expect(Object.values(met('', () => 4)).some(Boolean)).toBe(false)
  })

  test('strength is not met until the scorer has loaded', () => {
    expect(met('Granite-Orbit-47x').strength).toBe(false)
    expect(met('Granite-Orbit-47x', () => 3).strength).toBe(true)
    expect(met('Granite-Orbit-47x', () => 2).strength).toBe(false)
  })

  test('the scorer rejects common passwords and accepts unguessable ones', async () => {
    const score = await loadStrengthScorer()

    expect(met('Password1234!', score).strength).toBe(false)
    expect(met('Granite-Orbit-47x', score).strength).toBe(true)
  })
})
