import { ref, onBeforeUnmount } from 'vue'

/**
 * Composable for managing fullscreen/maximize functionality
 * Handles body scroll locking and CSS class management
 */
export function useFullscreen() {
  const isMaximized = ref(false)

  const toggleMaximize = () => {
    isMaximized.value = !isMaximized.value
    updateBodyState()
  }

  const updateBodyState = () => {
    if (isMaximized.value) {
      document.body.style.overflow = 'hidden'
      document.body.classList.add('fullscreen-overlay-active')
    } else {
      document.body.style.overflow = ''
      document.body.classList.remove('fullscreen-overlay-active')
    }
  }

  // Cleanup on unmount
  onBeforeUnmount(() => {
    document.body.style.overflow = ''
    document.body.classList.remove('fullscreen-overlay-active')
  })

  return {
    isMaximized,
    toggleMaximize,
  }
}

