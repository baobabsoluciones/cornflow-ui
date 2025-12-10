<template>
  <div class="m-tabs" :class="tabsClasses">
    <!-- Left arrow button -->
    <button
      v-if="showLeftArrow"
      class="m-tabs__arrow m-tabs__arrow--left"
      @click="scrollLeft"
      :disabled="!canScrollLeft"
      type="button"
      aria-label="Scroll left"
    >
      <v-icon icon="mdi-chevron-left" size="24" />
    </button>

    <!-- Tabs container with scroll -->
    <div
      ref="tabsContainerRef"
      class="m-tabs__container"
      @scroll="handleScroll"
      @wheel="handleWheel"
    >
      <div ref="tabsWrapperRef" class="m-tabs__wrapper">
        <slot />
      </div>
    </div>

    <!-- Right ellipsis dropdown -->
    <div class="m-tabs__ellipsis m-tabs__ellipsis--right">
      <v-menu location="bottom end" :close-on-content-click="true">
        <template #activator="{ props: menuProps }">
          <button
            v-bind="menuProps"
            class="m-tabs__ellipsis-button"
            type="button"
            aria-label="Show all tabs"
          >
            <v-icon icon="mdi-dots-horizontal" size="20" />
          </button>
        </template>
        <v-list class="m-tabs__dropdown">
          <v-list-item
            v-for="tab in allTabs"
            :key="`all-${tab.value}`"
            :class="[
              'm-tabs__dropdown-item',
              { 'm-tabs__dropdown-item--selected': isTabSelected(tab) },
            ]"
            @click="selectTabFromDropdown(tab)"
          >
            <v-list-item-title>{{ tab.label }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

    <!-- Right arrow button -->
    <button
      v-if="showRightArrow"
      class="m-tabs__arrow m-tabs__arrow--right"
      @click="scrollRight"
      :disabled="!canScrollRight"
      type="button"
      aria-label="Scroll right"
    >
      <v-icon icon="mdi-chevron-right" size="24" />
    </button>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  provide,
  watch,
  onMounted,
  onUnmounted,
  nextTick,
} from 'vue'

interface TabInfo {
  value: string | number
  label: string
  element: HTMLElement | null
}

interface Props {
  modelValue?: string | number
  color?: string
  sliderColor?: string
  fixed?: boolean
  stacked?: boolean
  alignTabs?: 'start' | 'center' | 'end'
  grow?: boolean
  height?: string | number
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  color: undefined,
  sliderColor: undefined,
  fixed: false,
  stacked: false,
  alignTabs: 'start',
  grow: false,
  height: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | undefined]
  change: [value: string | number | undefined]
}>()

const tabsContainerRef = ref<HTMLElement | null>(null)
const tabsWrapperRef = ref<HTMLElement | null>(null)

// State
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
const showLeftArrow = ref(false)
const showRightArrow = ref(false)
// Right ellipsis is always shown to provide access to all tabs via dropdown
const showRightEllipsis = ref(true)
const registeredTabs = ref<Map<string | number, TabInfo>>(new Map())

// Get all tab elements
const getTabElements = () => {
  if (!tabsWrapperRef.value) return []
  return Array.from(tabsWrapperRef.value.children) as HTMLElement[]
}

// Register tab info
const registerTab = (
  value: string | number,
  label: string,
  element: HTMLElement | null,
) => {
  registeredTabs.value.set(value, { value, label, element })
  nextTick(() => {
    updateScrollState()
  })
}

// Unregister tab
const unregisterTab = (value: string | number) => {
  registeredTabs.value.delete(value)
}

// Computed
const tabsClasses = computed(() => {
  return [
    {
      'm-tabs--fixed': props.fixed,
      'm-tabs--stacked': props.stacked,
      'm-tabs--grow': props.grow,
    },
  ]
})

const hiddenLeftTabs = computed(() => {
  const tabElements = getTabElements()
  if (!tabsContainerRef.value) return []

  const containerLeft = tabsContainerRef.value.scrollLeft
  const hidden: TabInfo[] = []

  tabElements.forEach((element) => {
    const elementLeft = element.offsetLeft
    if (elementLeft < containerLeft) {
      // Find the tab info for this element
      const tabValue = element.getAttribute('data-tab-value')
      if (tabValue !== null) {
        const value = isNaN(Number(tabValue)) ? tabValue : Number(tabValue)
        const tabInfo = registeredTabs.value.get(value)
        if (tabInfo) {
          hidden.push(tabInfo)
        }
      }
    }
  })

  return hidden
})

const hiddenRightTabs = computed(() => {
  const tabElements = getTabElements()
  if (!tabsContainerRef.value) return []

  const containerLeft = tabsContainerRef.value.scrollLeft
  const containerWidth = tabsContainerRef.value.clientWidth
  const hidden: TabInfo[] = []

  tabElements.forEach((element) => {
    const elementLeft = element.offsetLeft
    const elementWidth = element.offsetWidth
    if (elementLeft + elementWidth > containerLeft + containerWidth) {
      // Find the tab info for this element
      const tabValue = element.getAttribute('data-tab-value')
      if (tabValue !== null) {
        const value = isNaN(Number(tabValue)) ? tabValue : Number(tabValue)
        const tabInfo = registeredTabs.value.get(value)
        if (tabInfo) {
          hidden.push(tabInfo)
        }
      }
    }
  })

  return hidden
})

// All tabs for dropdown (sorted by their order in the DOM)
const allTabs = computed(() => {
  const tabElements = getTabElements()
  const all: TabInfo[] = []

  tabElements.forEach((element) => {
    const tabValue = element.getAttribute('data-tab-value')
    if (tabValue !== null) {
      const value = isNaN(Number(tabValue)) ? tabValue : Number(tabValue)
      const tabInfo = registeredTabs.value.get(value)
      if (tabInfo) {
        all.push(tabInfo)
      }
    }
  })

  return all
})

// Methods
const updateScrollState = () => {
  if (!tabsContainerRef.value) return

  const container = tabsContainerRef.value
  const scrollLeft = container.scrollLeft
  const scrollWidth = container.scrollWidth
  const clientWidth = container.clientWidth

  canScrollLeft.value = scrollLeft > 0
  canScrollRight.value = scrollLeft < scrollWidth - clientWidth - 1

  // Show arrows if content overflows
  const needsArrows = scrollWidth > clientWidth
  showLeftArrow.value = needsArrows
  showRightArrow.value = needsArrows

  // Right ellipsis is always shown to avoid issues when screen size changes
  // It provides access to all tabs via dropdown menu
  showRightEllipsis.value = true
}

const scrollLeft = () => {
  if (!tabsContainerRef.value) return
  const scrollAmount = tabsContainerRef.value.clientWidth * 0.8
  tabsContainerRef.value.scrollBy({ left: -scrollAmount, behavior: 'smooth' })
}

const scrollRight = () => {
  if (!tabsContainerRef.value) return
  const scrollAmount = tabsContainerRef.value.clientWidth * 0.8
  tabsContainerRef.value.scrollBy({ left: scrollAmount, behavior: 'smooth' })
}

const handleScroll = () => {
  updateScrollState()
}

const handleWheel = (event: WheelEvent) => {
  if (!tabsContainerRef.value) return
  if (event.deltaY !== 0) {
    event.preventDefault()
    tabsContainerRef.value.scrollLeft += event.deltaY
  }
}

const selectTab = (value: any) => {
  emit('update:modelValue', value)
  emit('change', value)

  // Scroll to selected tab
  nextTick(() => {
    scrollToTab(value)
  })
}

const scrollToTab = (value: any) => {
  if (!tabsContainerRef.value || !tabsWrapperRef.value) return

  const tabInfo = registeredTabs.value.get(value)
  if (!tabInfo || !tabInfo.element) return

  const tabElement = tabInfo.element
  const container = tabsContainerRef.value
  const containerLeft = container.scrollLeft
  const containerWidth = container.clientWidth
  const tabLeft = tabElement.offsetLeft
  const tabWidth = tabElement.offsetWidth

  // Check if tab is visible
  const isVisible =
    tabLeft >= containerLeft &&
    tabLeft + tabWidth <= containerLeft + containerWidth

  if (!isVisible) {
    // Scroll to make tab visible
    if (tabLeft < containerLeft) {
      // Tab is to the left, scroll left
      container.scrollTo({ left: tabLeft - 20, behavior: 'smooth' })
    } else {
      // Tab is to the right, scroll right
      container.scrollTo({
        left: tabLeft + tabWidth - containerWidth + 20,
        behavior: 'smooth',
      })
    }
  }
}

const selectTabFromDropdown = (tab: TabInfo) => {
  selectTab(tab.value)
}

const isTabSelected = (tab: TabInfo) => {
  return tab.value === props.modelValue
}

// Provide context to child CoreTab components
provide('coreTabs', {
  modelValue: computed(() => props.modelValue),
  selectTab,
  color: computed(() => props.color),
  sliderColor: computed(() => props.sliderColor),
  registerTab,
  unregisterTab,
})

// Watch for modelValue changes to scroll to selected tab
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue !== undefined) {
      nextTick(() => {
        scrollToTab(newValue)
      })
    }
  },
)

// Lifecycle
onMounted(() => {
  updateScrollState()
  // Use ResizeObserver to detect container size changes
  if (tabsContainerRef.value) {
    const resizeObserver = new ResizeObserver(() => {
      updateScrollState()
    })
    resizeObserver.observe(tabsContainerRef.value)

    onUnmounted(() => {
      resizeObserver.disconnect()
    })
  }

  // Initial scroll to selected tab
  if (props.modelValue !== undefined) {
    nextTick(() => {
      scrollToTab(props.modelValue)
    })
  }
})

// Update scroll state on window resize
if (typeof window !== 'undefined') {
  window.addEventListener('resize', updateScrollState)
  onUnmounted(() => {
    window.removeEventListener('resize', updateScrollState)
  })
}
</script>

<style scoped>
.m-tabs {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  background-color: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.m-tabs__arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  min-width: 48px;
  background-color: transparent;
  border: none;
  color: rgba(var(--v-theme-on-surface), 0.6);
  cursor: pointer;
  transition: color 0.2s;
  flex-shrink: 0;
  z-index: 1;
}

.m-tabs__arrow:hover:not(:disabled) {
  color: rgba(var(--v-theme-on-surface), 0.87);
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.m-tabs__arrow:disabled {
  opacity: 0.38;
  cursor: default;
}

.m-tabs__ellipsis {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  min-width: 48px;
  flex-shrink: 0;
  z-index: 1;
}

.m-tabs__ellipsis-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: transparent;
  border: none;
  color: rgba(var(--v-theme-on-surface), 0.6);
  cursor: pointer;
  transition:
    color 0.2s,
    background-color 0.2s;
  border-radius: 4px;
}

.m-tabs__ellipsis-button:hover {
  color: rgba(var(--v-theme-on-surface), 0.87);
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.m-tabs__container {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.m-tabs__container::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

.m-tabs__wrapper {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  position: relative;
}

.m-tabs--grow .m-tabs__wrapper {
  width: 100%;
}

.m-tabs--grow .m-tabs__wrapper > * {
  flex: 1 1 auto;
}

.m-tabs__dropdown {
  max-height: 300px;
  overflow-y: auto;
}

.m-tabs__dropdown-item {
  cursor: pointer;
}

.m-tabs__dropdown-item--selected {
  background-color: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}

.m-tabs__dropdown-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}
</style>
