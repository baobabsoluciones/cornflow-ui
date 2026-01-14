import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'

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

  /**
   * Get the height of the filters panel if visible
   */
  const getFiltersPanelHeight = (): number => {
    if (!tableContainer.value) return 0

    // Find the core-table-container parent
    let parent = tableContainer.value.parentElement
    let coreTableContainer: HTMLElement | null = null
    while (parent) {
      if (parent.classList.contains('core-table-container')) {
        coreTableContainer = parent as HTMLElement
        break
      }
      parent = parent.parentElement
    }

    if (!coreTableContainer) return 0

    // Look for the filters panel within the table container
    const filtersPanel = coreTableContainer.querySelector(
      '.core-filters-panel',
    ) as HTMLElement | null

    if (!filtersPanel) return 0

    // Get the actual height of the filters panel
    const rect = filtersPanel.getBoundingClientRect()
    return rect.height > 0 ? rect.height : 0
  }

  /**
   * Get the height of the search/action bar
   */
  const getSearchBarHeight = (): number => {
    if (!tableContainer.value) return 60 // Default estimate

    // Find the search bar container (d-flex with search input)
    let parent = tableContainer.value.parentElement
    let coreTableContainer: HTMLElement | null = null
    while (parent) {
      if (parent.classList.contains('core-table-container')) {
        coreTableContainer = parent as HTMLElement
        break
      }
      parent = parent.parentElement
    }

    if (!coreTableContainer) return 60

    // Find the search bar (first d-flex with justify-space-between)
    const searchBar = coreTableContainer.querySelector(
      '.d-flex.justify-space-between',
    ) as HTMLElement | null

    if (!searchBar) return 60

    const rect = searchBar.getBoundingClientRect()
    return rect.height > 0 ? rect.height + 32 : 60 // Add margin (ma-4 = 16px * 2)
  }

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
        fullscreenBodyElement = parent as HTMLElement
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
        return parent as HTMLElement
      }
      parent = parent.parentElement
    }
    return null
  }

  /**
   * Calculate the optimal table height based on available space
   */
  const calculateTableHeight = () => {
    if (!tableContainer.value) return

    const { isMaximized, fullscreenBody } = isInFullscreenMode()
    const containerRect = tableContainer.value.getBoundingClientRect()

    // Get dynamic heights
    const filtersPanelHeight = getFiltersPanelHeight()
    const searchBarHeight = getSearchBarHeight()

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
      const viewportHeight = window.innerHeight

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
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth

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
    const viewportHeight = window.innerHeight

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
    resizeTimeout.value = window.setTimeout(() => {
      calculateTableHeight()
    }, 50) // Faster response for smoother resize
  }

  /**
   * Set up observer for fullscreen body changes
   */
  const setupFullscreenBodyObserver = () => {
    if (!window.ResizeObserver || !tableContainer.value) return

    const findFullscreenBody = () => {
      if (!tableContainer.value) return null
      let parent = tableContainer.value.parentElement
      while (parent) {
        if (parent.classList.contains('fullscreen-body')) {
          return parent as HTMLElement
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
    if (!window.ResizeObserver || !tableContainer.value) return

    // Find the core-table-container parent
    let parent = tableContainer.value.parentElement
    let coreTableContainer: HTMLElement | null = null
    while (parent) {
      if (parent.classList.contains('core-table-container')) {
        coreTableContainer = parent as HTMLElement
        break
      }
      parent = parent.parentElement
    }

    if (!coreTableContainer) return

    // Find the filters panel
    const filtersPanel = coreTableContainer.querySelector(
      '.core-filters-panel',
    ) as HTMLElement | null

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
    if (!window.ResizeObserver || !tableContainer.value) return

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
    window.addEventListener('resize', handleWindowResize)

    // Watch for fullscreen state changes on body
    if (window.MutationObserver) {
      mutationObserver.value = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === 'attributes' &&
            mutation.attributeName === 'class'
          ) {
            // Fullscreen state changed
            nextTick(() => {
              calculateTableHeight()
              setupFullscreenBodyObserver()
              setupFiltersPanelObserver()
            })
          }
        })
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
          coreTableContainer = parent as HTMLElement
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

      // Recalculate after a short delay to ensure DOM is fully rendered
      setTimeout(() => {
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

    window.removeEventListener('resize', handleWindowResize)

    if (resizeTimeout.value) {
      clearTimeout(resizeTimeout.value)
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
