import { ref, onMounted, onUnmounted, nextTick } from 'vue'

export function useTableHeight() {
  const tableHeight = ref(400)
  const tableContainer = ref<HTMLElement | null>(null)
  const resizeObserver = ref<ResizeObserver | null>(null)
  const fullscreenBodyObserver = ref<ResizeObserver | null>(null)
  const filtersPanelObserver = ref<ResizeObserver | null>(null)
  const mutationObserver = ref<MutationObserver | null>(null)
  const containerMutationObserver = ref<MutationObserver | null>(null)
  const resizeTimeout = ref<number | null>(null)

  const isFiltersPanelVisible = (): boolean => {
    if (!tableContainer.value) return false

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

    if (!coreTableContainer) return false

    // Look for the filters panel within the table container
    const filtersPanel = coreTableContainer.querySelector(
      '.core-filters-panel',
    ) as HTMLElement | null

    if (!filtersPanel) return false

    // Check if the panel is visible (has height > 0)
    const rect = filtersPanel.getBoundingClientRect()
    return rect.height > 0 && rect.width > 0
  }

  const calculateTableHeight = () => {
    if (!tableContainer.value) return

    // Check if we're in a maximized/fullscreen view
    const isMaximized = document.body.classList.contains(
      'fullscreen-overlay-active',
    )

    // Find the closest fullscreen-body parent to check if we're in fullscreen mode
    let parent = tableContainer.value.parentElement
    let fullscreenBodyElement: HTMLElement | null = null
    while (parent) {
      if (parent.classList.contains('fullscreen-body')) {
        fullscreenBodyElement = parent as HTMLElement
        break
      }
      parent = parent.parentElement
    }

    const inMaximizedView = isMaximized || fullscreenBodyElement !== null

    // Check if filters panel is visible
    const filtersVisible = isFiltersPanelVisible()

    // Get the container element position
    const containerRect = tableContainer.value.getBoundingClientRect()

    let availableHeight: number
    let bottomPadding: number

    if (inMaximizedView && fullscreenBodyElement) {
      // When maximized, calculate based on the fullscreen-body container
      const fullscreenBodyRect = fullscreenBodyElement.getBoundingClientRect()
      // Adjust padding based on filters panel visibility
      // Fullscreen + filters visible: 100px, Fullscreen + filters hidden: 50px
      bottomPadding = filtersVisible ? 80 : 50
      availableHeight =
        fullscreenBodyRect.bottom - containerRect.top - bottomPadding
    } else {
      // Normal view: calculate based on viewport
      const viewportHeight = window.innerHeight
      // Adjust padding based on filters panel visibility
      // Normal + filters visible: 265px, Normal + filters hidden: 180px
      bottomPadding = filtersVisible ? 265 : 190
      availableHeight = viewportHeight - containerRect.top - bottomPadding
    }

    // Set minimum and maximum heights
    // When maximized, allow larger maximum height
    const minHeight = 300
    const maxHeight = inMaximizedView ? 1800 : 1200

    // Calculate the final height
    let newHeight = Math.max(minHeight, availableHeight)
    newHeight = Math.min(maxHeight, newHeight)

    // Only update if there's a significant change (avoid unnecessary re-renders)
    if (Math.abs(tableHeight.value - newHeight) > 10) {
      tableHeight.value = newHeight
    }
  }

  const handleWindowResize = () => {
    if (resizeTimeout.value) {
      clearTimeout(resizeTimeout.value)
    }
    resizeTimeout.value = window.setTimeout(() => {
      calculateTableHeight()
    }, 100)
  }

  const setupFullscreenBodyObserver = () => {
    if (!window.ResizeObserver || !tableContainer.value) return

    // Find fullscreen-body if it exists
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

    // Disconnect existing observer if it exists
    if (fullscreenBodyObserver.value) {
      fullscreenBodyObserver.value.disconnect()
      fullscreenBodyObserver.value = null
    }

    // Set up new observer if fullscreen-body exists
    if (fullscreenBody) {
      fullscreenBodyObserver.value = new ResizeObserver(() => {
        if (resizeTimeout.value) {
          clearTimeout(resizeTimeout.value)
        }
        resizeTimeout.value = window.setTimeout(() => {
          calculateTableHeight()
        }, 100)
      })
      fullscreenBodyObserver.value.observe(fullscreenBody)
    }
  }

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

    // Disconnect existing observer if it exists
    if (filtersPanelObserver.value) {
      filtersPanelObserver.value.disconnect()
      filtersPanelObserver.value = null
    }

    // Set up new observer if filters panel exists
    if (filtersPanel) {
      filtersPanelObserver.value = new ResizeObserver(() => {
        if (resizeTimeout.value) {
          clearTimeout(resizeTimeout.value)
        }
        resizeTimeout.value = window.setTimeout(() => {
          calculateTableHeight()
        }, 100)
      })
      filtersPanelObserver.value.observe(filtersPanel)
    }
  }

  const setupResizeObserver = () => {
    if (!window.ResizeObserver || !tableContainer.value) return

    resizeObserver.value = new ResizeObserver(() => {
      // Debounce the resize calculation
      if (resizeTimeout.value) {
        clearTimeout(resizeTimeout.value)
      }
      resizeTimeout.value = window.setTimeout(() => {
        calculateTableHeight()
      }, 100)
    })

    // Observe the container
    resizeObserver.value.observe(tableContainer.value)

    // Set up fullscreen-body observer
    setupFullscreenBodyObserver()

    // Set up filters panel observer
    setupFiltersPanelObserver()

    // Also listen to window resize events
    window.addEventListener('resize', handleWindowResize)

    // Watch for fullscreen state changes on body
    if (window.MutationObserver) {
      mutationObserver.value = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === 'attributes' &&
            mutation.attributeName === 'class'
          ) {
            // Fullscreen state changed, recalculate and update observers
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

      // Also observe the core-table-container for DOM changes (filters panel might be added/removed)
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
          // Filters panel might have been added/removed, update observer
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

  const initializeHeight = () => {
    nextTick(() => {
      calculateTableHeight()
      setupResizeObserver()
    })
  }

  const cleanup = () => {
    // Clean up resize observer
    if (resizeObserver.value) {
      resizeObserver.value.disconnect()
    }

    // Clean up fullscreen body observer
    if (fullscreenBodyObserver.value) {
      fullscreenBodyObserver.value.disconnect()
    }

    // Clean up filters panel observer
    if (filtersPanelObserver.value) {
      filtersPanelObserver.value.disconnect()
    }

    // Clean up mutation observer
    if (mutationObserver.value) {
      mutationObserver.value.disconnect()
    }

    // Clean up container mutation observer
    if (containerMutationObserver.value) {
      containerMutationObserver.value.disconnect()
    }

    // Clean up event listeners
    window.removeEventListener('resize', handleWindowResize)

    // Clear any pending timeouts
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
