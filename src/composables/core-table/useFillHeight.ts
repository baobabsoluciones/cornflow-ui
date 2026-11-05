/**
 * useFillHeight — the height an element can take to reach the bottom of what holds it: the
 * closest ancestor marked `data-table-bounds` when there is one (a card with a height of its
 * own), else the window. Kept up to date on resize and scroll; never below `min`.
 *
 *   const height = useFillHeight(card, { min: 320, gap: 24 })
 *   <div ref="card" :style="{ height: `${height}px` }">
 */
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export function useFillHeight(
  element: Ref<HTMLElement | undefined>,
  { min = 320, gap = 24 }: { min?: number; gap?: number } = {},
) {
  const height = ref(min)

  function measure() {
    const target = element.value
    if (!target) return
    const top = target.getBoundingClientRect().top
    const bounds = target.parentElement?.closest<HTMLElement>('[data-table-bounds]')
    const bottom = bounds ? bounds.getBoundingClientRect().bottom : window.innerHeight
    height.value = Math.max(min, Math.floor(bottom - top - (bounds ? 0 : gap)))
  }

  let observer: ResizeObserver | undefined
  let frame = 0
  const schedule = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(measure)
  }

  onMounted(() => {
    measure()
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(schedule)
      observer.observe(document.body)
      const bounds = element.value?.parentElement?.closest('[data-table-bounds]')
      if (bounds) observer.observe(bounds)
    }
  })

  onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', schedule)
    window.removeEventListener('scroll', schedule, true)
    observer?.disconnect()
  })

  return height
}
