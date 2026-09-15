/**
 * layoutOffsets.ts — Reactive layout-offset channel (core ← premium).
 *
 * The CORE defines this channel; premium global components (e.g. fixed banners at the top)
 * report here the height they occupy when visible. The core layout
 * (`IndexView` → `.main-content`) reads the total and leaves that gap, WITHOUT knowing any premium module.
 *
 * Invariant: the core imports no concrete banners nor their stores to compute the padding; it only
 * sums the contributions registered by key. No premium modules → total 0 (no offset).
 */
import { reactive, computed, type ComputedRef } from 'vue'

/** Heights (px) of fixed top banners, contributed by premium components, keyed by name. */
const topBannerOffsets = reactive<Record<string, number>>({})

/**
 * A premium component reports the height (px) its fixed banner occupies at the top.
 * `px <= 0` (or a hidden/unmounted banner) removes the contribution.
 */
export function setTopBannerOffset(key: string, px: number): void {
  if (px && px > 0) topBannerOffsets[key] = px
  else delete topBannerOffsets[key]
}

/** Total padding-top (px) the core's `main-content` needs to clear the fixed banners. */
export const totalTopBannerOffset: ComputedRef<number> = computed(() =>
  Object.values(topBannerOffsets).reduce((sum, px) => sum + px, 0),
)

/** Clears all contributions (used in tests to isolate state between cases). */
export function resetTopBannerOffsets(): void {
  for (const key of Object.keys(topBannerOffsets)) delete topBannerOffsets[key]
}
