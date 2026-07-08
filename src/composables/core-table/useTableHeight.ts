import { ref, onMounted, onUnmounted, nextTick } from 'vue'

/**
 * Composable for dynamic table height calculation
 * Ensures the table fills available space responsively
 */
export function useTableHeight() {
  const tableHeight = ref(400)
  const tableContainer = ref<HTMLElement | null>(null)
  const resizeObserver = ref<ResizeObserver | null>(null)
  const fullscreenBodyObserver = ref<ResizeObserver | null>(null)
  const filtersPanelObserver = ref<ResizeObserver | null>(null)
  const mutationObserver = ref<MutationObserver | null>(null)
  const containerMutationObserver = ref<MutationObserver | null>(null)
  const resizeTimeout = ref<number | null>(null)
  const initTimeout = ref<number | null>(null)

  /**
   * Check if we're in a maximized/fullscreen view
   */
  const isInFullscreenMode = (): {
    isMaximized: boolean
    fullscreenBody: HTMLElement | null
  } => {
    const isMaximized = document.body.classList.contains(
      'fullscreen-overlay-active',
    )

    let parent = tableContainer.value?.parentElement
    let fullscreenBodyElement: HTMLElement | null = null
    while (parent) {
      if (parent.classList.contains('fullscreen-body')) {
        fullscreenBodyElement = parent
        break
      }
      parent = parent.parentElement
    }

    return {
      isMaximized: isMaximized || fullscreenBodyElement !== null,
      fullscreenBody: fullscreenBodyElement,
    }
  }

  /**
   * Find the closest scrollable parent to determine available space
   */
  const getScrollableParent = (): HTMLElement | null => {
    if (!tableContainer.value) return null

    let parent = tableContainer.value.parentElement
    while (parent) {
      const style = getComputedStyle(parent)
      const overflowY = style.overflowY

      if (
        overflowY === 'auto' ||
        overflowY === 'scroll' ||
        parent.classList.contains('view-container') ||
        parent.classList.contains('table-card-content')
      ) {
        return parent
      }
      parent = parent.parentElement
    }
    return null
  }

  /**
   * Calculate the optimal table height based on available space
   */
  const calculateTableHeight = () => {
    // Guard against the DOM being unavailable. Deferred timers/observers can
    // fire after the host environment is torn down (e.g. after a test unmounts
    // its component), at which point `document`/`window` no longer exist and
    // the callback would throw an unhandled ReferenceError.
    if (typeof document === 'undefined' || typeof globalThis.window === 'undefined')
      return
    if (!tableContainer.value) return

    const { isMaximized, fullscreenBody } = isInFullscreenMode()
    const containerRect = tableContainer.value.getBoundingClientRect()

    let availableHeight: number

    if (isMaximized && fullscreenBody) {
      // Fullscreen mode: calculate based on the fullscreen-body container
      const fullscreenBodyRect = fullscreenBody.getBoundingClientRect()
      // Only account for the space from the table container to the bottom of fullscreen body
      // Add a small buffer for any padding/margin
      const bottomBuffer = 20
      availableHeight =
        fullscreenBodyRect.bottom - containerRect.top - bottomBuffer
    } else {
      // Normal mode: calculate based on viewport
      const viewportHeight = globalThis.window.innerHeight

      // Calculate the space needed at the bottom (footer, padding, etc.)
      // Use dynamic calculation instead of hardcoded values
      const bottomOffset = calculateBottomOffset()

      availableHeight = viewportHeight - containerRect.top - bottomOffset
    }

    // Apply constraints
    const minHeight = getMinHeight()
    const maxHeight = isMaximized ? 2000 : 1500

    // Calculate the final height
    let newHeight = Math.max(minHeight, availableHeight)
    newHeight = Math.min(maxHeight, newHeight)

    // Only update if there's a significant change (avoid unnecessary re-renders)
    if (Math.abs(tableHeight.value - newHeight) > 5) {
      tableHeight.value = Math.round(newHeight)
    }
  }

  /**
   * Calculate the bottom offset dynamically based on screen size
   */
  const calculateBottomOffset = (): number => {
    const viewportHeight = globalThis.window.innerHeight
    const viewportWidth = globalThis.window.innerWidth

    // Base offset for common UI elements (footer padding, card margins, etc.)
    let baseOffset = 80

    // Adjust based on screen height
    if (viewportHeight < 600) {
      baseOffset = 70
    } else if (viewportHeight < 800) {
      baseOffset = 75
    } else if (viewportHeight > 1200) {
      baseOffset = 90
    }

    // Adjust based on screen width (smaller screens might have different layouts)
    if (viewportWidth < 768) {
      baseOffset += 10
    }

    return baseOffset
  }

  /**
   * Get minimum table height based on screen size
   */
  const getMinHeight = (): number => {
    const viewportHeight = globalThis.window.innerHeight

    if (viewportHeight < 500) {
      return 200
    } else if (viewportHeight < 700) {
      return 250
    } else if (viewportHeight < 900) {
      return 300
    }
    return 350
  }

  /**
   * Debounced handler for window resize events
   */
  const handleWindowResize = () => {
    if (resizeTimeout.value) {
      clearTimeout(resizeTimeout.value)
    }
    resizeTimeout.value = globalThis.window.setTimeout(() => {
      calculateTableHeight()
    }, 50) // Faster response for smoother resize
  }

  /**
   * Set up observer for fullscreen body changes
   */
  const setupFullscreenBodyObserver = () => {
    if (!globalThis.window.ResizeObserver || !tableContainer.value) return

    const findFullscreenBody = () => {
      if (!tableContainer.value) return null
      let parent = tableContainer.value.parentElement
      while (parent) {
        if (parent.classList.contains('fullscreen-body')) {
          return parent
        }
        parent = parent.parentElement
      }
      return null
    }

    const fullscreenBody = findFullscreenBody()

    // Disconnect existing observer
    if (fullscreenBodyObserver.value) {
      fullscreenBodyObserver.value.disconnect()
      fullscreenBodyObserver.value = null
    }

    // Set up new observer if fullscreen-body exists
    if (fullscreenBody) {
      fullscreenBodyObserver.value = new ResizeObserver(() => {
        handleWindowResize()
      })
      fullscreenBodyObserver.value.observe(fullscreenBody)
    }
  }

  /**
   * Set up observer for filters panel changes
   */
  const setupFiltersPanelObserver = () => {
    if (!globalThis.window.ResizeObserver || !tableContainer.value) return

    // Find the core-table-container parent
    let parent = tableContainer.value.parentElement
    let coreTableContainer: HTMLElement | null = null
    while (parent) {
      if (parent.classList.contains('core-table-container')) {
        coreTableContainer = parent
        break
      }
      parent = parent.parentElement
    }

    if (!coreTableContainer) return

    // Find the filters panel
    const filtersPanel = coreTableContainer.querySelector('.core-filters-panel')

    // Disconnect existing observer
    if (filtersPanelObserver.value) {
      filtersPanelObserver.value.disconnect()
      filtersPanelObserver.value = null
    }

    // Set up new observer if filters panel exists
    if (filtersPanel) {
      filtersPanelObserver.value = new ResizeObserver(() => {
        handleWindowResize()
      })
      filtersPanelObserver.value.observe(filtersPanel)
    }
  }

  /**
   * Set up all resize observers
   */
  const setupResizeObserver = () => {
    if (!globalThis.window.ResizeObserver || !tableContainer.value) return

    resizeObserver.value = new ResizeObserver(() => {
      handleWindowResize()
    })

    // Observe the container
    resizeObserver.value.observe(tableContainer.value)

    // Also observe parent containers for layout changes
    const scrollableParent = getScrollableParent()
    if (scrollableParent && scrollableParent !== tableContainer.value) {
      resizeObserver.value.observe(scrollableParent)
    }

    // Set up fullscreen-body observer
    setupFullscreenBodyObserver()

    // Set up filters panel observer
    setupFiltersPanelObserver()

    // Listen to window resize events
    globalThis.window.addEventListener('resize', handleWindowResize)

    // Watch for fullscreen state changes on body
    if (globalThis.window.MutationObserver) {
      const handleClassMutation = (mutation: MutationRecord) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          nextTick(() => {
            calculateTableHeight()
            setupFullscreenBodyObserver()
            setupFiltersPanelObserver()
          })
        }
      }

      mutationObserver.value = new MutationObserver((mutations) => {
        mutations.forEach(handleClassMutation)
      })

      // Observe body for class changes
      mutationObserver.value.observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
      })

      // Also observe the core-table-container for DOM changes
      let parent = tableContainer.value.parentElement
      let coreTableContainer: HTMLElement | null = null
      while (parent) {
        if (parent.classList.contains('core-table-container')) {
          coreTableContainer = parent
          break
        }
        parent = parent.parentElement
      }

      if (coreTableContainer) {
        containerMutationObserver.value = new MutationObserver(() => {
          nextTick(() => {
            setupFiltersPanelObserver()
            calculateTableHeight()
          })
        })

        containerMutationObserver.value.observe(coreTableContainer, {
          childList: true,
          subtree: true,
        })
      }
    }
  }

  /**
   * Initialize the height calculation
   */
  const initializeHeight = () => {
    nextTick(() => {
      calculateTableHeight()
      setupResizeObserver()

      // Recalculate after a short delay to ensure DOM is fully rendered.
      // Track the handle so cleanup() can cancel it and it never fires after
      // the component (or test host) is torn down.
      initTimeout.value = globalThis.window.setTimeout(() => {
        initTimeout.value = null
        calculateTableHeight()
      }, 100)
    })
  }

  /**
   * Clean up all observers and event listeners
   */
  const cleanup = () => {
    if (resizeObserver.value) {
      resizeObserver.value.disconnect()
    }

    if (fullscreenBodyObserver.value) {
      fullscreenBodyObserver.value.disconnect()
    }

    if (filtersPanelObserver.value) {
      filtersPanelObserver.value.disconnect()
    }

    if (mutationObserver.value) {
      mutationObserver.value.disconnect()
    }

    if (containerMutationObserver.value) {
      containerMutationObserver.value.disconnect()
    }

    globalThis.window.removeEventListener('resize', handleWindowResize)

    if (resizeTimeout.value) {
      clearTimeout(resizeTimeout.value)
      resizeTimeout.value = null
    }

    if (initTimeout.value) {
      clearTimeout(initTimeout.value)
      initTimeout.value = null
    }
  }

  onMounted(() => {
    initializeHeight()
  })

  onUnmounted(() => {
    cleanup()
  })

  return {
    tableHeight,
    tableContainer,
    calculateTableHeight,
    initializeHeight,
  }
}
