/**
 * layoutOffsets.ts — Reactive layout-offset channel (core ← premium).
 *
 * The CORE defines this channel; premium global components (e.g. fixed banners at the top, or a
 * panel docked on the right edge) report here the room they occupy when visible. The core layout
 * (`IndexView` → `.main-content`) reads the totals and leaves that gap, WITHOUT knowing any premium module.
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

/** Widths (px) of panels fixed on the right edge, contributed by premium components, keyed by name. */
const rightPanelOffsets = reactive<Record<string, number>>({})

/**
 * A premium component reports the width (px) its panel takes on the right edge (a folded rail, a
 * pinned side panel). The page, the top bar and the execution tabs end where it starts.
 * `px <= 0` (or a hidden/unmounted panel) removes the contribution. A panel that floats over the
 * page reports nothing.
 */
export function setRightPanelOffset(key: string, px: number): void {
  if (px && px > 0) rightPanelOffsets[key] = px
  else delete rightPanelOffsets[key]
}

/** Total room (px) the core layout leaves on the right edge (`--app-right-offset`). */
export const totalRightPanelOffset: ComputedRef<number> = computed(() =>
  Object.values(rightPanelOffsets).reduce((sum, px) => sum + px, 0),
)

/** Clears all right-edge contributions (used in tests). */
export function resetRightPanelOffsets(): void {
  for (const key of Object.keys(rightPanelOffsets)) delete rightPanelOffsets[key]
}
