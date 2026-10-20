import { onBeforeUnmount, onMounted, type Ref } from 'vue'

/**
 * Calls `onOutside` on a pointerdown that lands outside `target`'s element, for closing a
 * dropdown or popover when the user clicks anywhere else on the page. Only fires while
 * `isOpen()` returns true, so the same click that opens it (through a toggle button that lives
 * inside `target`) never closes it again.
 *
 * Listens on the capture phase, so it still sees the click when something inside the target
 * stops its propagation.
 */
export function useClickOutside(
  target: Ref<HTMLElement | null>,
  isOpen: () => boolean,
  onOutside: () => void,
) {
  const handlePointerDown = (event: PointerEvent) => {
    if (!isOpen()) return
    const el = target.value
    if (!el || el.contains(event.target as Node)) return
    onOutside()
  }

  onMounted(() =>
    document.addEventListener('pointerdown', handlePointerDown, true),
  )
  onBeforeUnmount(() =>
    document.removeEventListener('pointerdown', handlePointerDown, true),
  )
}
