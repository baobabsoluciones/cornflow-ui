import { describe, test, expect, beforeEach } from 'vitest'
import {
  setTopBannerOffset,
  totalTopBannerOffset,
  resetTopBannerOffsets,
} from '@/plugins/layoutOffsets'

describe('layoutOffsets (core layout channel)', () => {
  beforeEach(() => {
    resetTopBannerOffsets()
  })

  test('starts at zero with no contributions', () => {
    expect(totalTopBannerOffset.value).toBe(0)
  })

  test('sums contributions across keys', () => {
    setTopBannerOffset('a', 48)
    setTopBannerOffset('b', 48)
    expect(totalTopBannerOffset.value).toBe(96)
  })

  test('a zero/negative value removes the contribution', () => {
    setTopBannerOffset('a', 48)
    expect(totalTopBannerOffset.value).toBe(48)
    setTopBannerOffset('a', 0)
    expect(totalTopBannerOffset.value).toBe(0)
  })

  test('updating the same key replaces (does not add) its contribution', () => {
    setTopBannerOffset('a', 48)
    setTopBannerOffset('a', 64)
    expect(totalTopBannerOffset.value).toBe(64)
  })
})
