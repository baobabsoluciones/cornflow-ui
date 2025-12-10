<template>
  <button
    ref="tabElementRef"
    :class="tabClasses"
    :style="tabStyle"
    :disabled="disabled"
    :value="value"
    :data-tab-value="value"
    type="button"
    role="tab"
    :aria-selected="isSelected"
    :aria-controls="`tabpanel-${value}`"
    :id="`tab-${value}`"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <span class="m-tab__wrapper">
      <span v-if="prependIcon || icon" class="m-tab__prepend">
        <v-icon :icon="prependIcon || icon" size="20" />
      </span>
      <span class="m-tab__content" :style="contentStyle">
        <slot>
          <span v-if="title">{{ title }}</span>
        </slot>
      </span>
      <span v-if="appendIcon" class="m-tab__append">
        <v-icon :icon="appendIcon" size="20" />
      </span>
    </span>
    <span
      v-if="isSelected && !hideSlider"
      class="m-tab__indicator"
      :style="indicatorStyle"
    ></span>
  </button>
</template>

<script setup lang="ts">
import { computed, inject, ref, onMounted, onUnmounted, watch } from 'vue'

// Props interface matching Vuetify's v-tab
interface Props {
  value?: string | number
  title?: string
  disabled?: boolean
  prependIcon?: string
  appendIcon?: string
  icon?: string
  hideSlider?: boolean
  stacked?: boolean
  fixed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  value: undefined,
  title: undefined,
  disabled: false,
  prependIcon: undefined,
  appendIcon: undefined,
  icon: undefined,
  hideSlider: false,
  stacked: false,
  fixed: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const tabElementRef = ref<HTMLElement | null>(null)

// Inject from parent CoreTabs component
const tabsContext = inject<{
  modelValue: any // This is a computed ref
  selectTab: (value: any) => void
  color?: any // This is a computed ref
  sliderColor?: any // This is a computed ref
  registerTab?: (
    value: string | number,
    label: string,
    element: HTMLElement | null,
  ) => void
  unregisterTab?: (value: string | number) => void
} | null>('coreTabs', null)

// Get tab label from slot content or title prop
const getTabLabel = (): string => {
  if (props.title) return props.title
  // Try to get text content from the element
  if (tabElementRef.value) {
    const textContent = tabElementRef.value.textContent?.trim()
    if (textContent) return textContent
  }
  return String(props.value ?? '')
}

// Computed properties
const isSelected = computed(() => {
  if (tabsContext) {
    // modelValue is a computed ref, so we need to access .value
    const currentValue = tabsContext.modelValue?.value
    const tabValue = props.value
    // Compare with type coercion to handle string vs number
    return currentValue == tabValue
  }
  return false
})

const tabClasses = computed(() => {
  return [
    'm-tab',
    {
      'm-tab--selected': isSelected.value,
      'm-tab--disabled': props.disabled,
      'm-tab--fixed': props.fixed,
      'm-tab--stacked': props.stacked,
    },
  ]
})

// Color mapping for common color names
const colorMap: Record<string, string> = {
  primary: 'var(--primary)',
  'primary-variant': 'var(--primary-variant)',
  secondary: 'var(--secondary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
}

// Helper to get the color value from context
const getColor = () => {
  if (!tabsContext) return undefined
  // sliderColor and color are already computed refs, so we access .value once
  const color = tabsContext.sliderColor?.value || tabsContext.color?.value
  if (!color) return undefined

  // If it's a mapped color name, convert it to CSS variable
  if (colorMap[color]) {
    return colorMap[color]
  }

  // If it's already a CSS variable or hex color, return as is
  return color
}

const indicatorStyle = computed(() => {
  // Use sliderColor prop, then color prop
  // If no custom color is provided, the CSS will use var(--primary) as fallback
  const color = getColor()
  if (color) {
    return {
      backgroundColor: color,
    }
  }
  // Return empty object so CSS var(--primary) is used
  return {}
})

const tabStyle = computed(() => {
  if (!isSelected.value) {
    return {
      borderBottomColor: 'transparent',
    }
  }

  // Use sliderColor prop, then color prop for the border
  const color = getColor()
  if (color) {
    return {
      borderBottom: `3px solid ${color}`,
      borderBottomColor: color,
    }
  }
  // Use CSS var(--primary) as fallback
  return {
    borderBottom: '3px solid var(--primary)',
    borderBottomColor: 'var(--primary)',
  }
})

const contentStyle = computed(() => {
  if (!isSelected.value) return {}

  // Use sliderColor prop, then color prop for the text color
  const color = getColor()
  if (color) {
    return {
      color: color,
    }
  }
  // Use CSS var(--primary) as fallback
  return {
    color: 'var(--primary)',
  }
})

// Methods
const handleClick = (event: MouseEvent) => {
  if (props.disabled) return

  if (tabsContext) {
    tabsContext.selectTab(props.value)
  }

  emit('click', event)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (props.disabled) return

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    handleClick(event as any)
  }
}

// Register/unregister with parent CoreTabs
onMounted(() => {
  if (tabsContext?.registerTab && props.value !== undefined) {
    tabsContext.registerTab(props.value, getTabLabel(), tabElementRef.value)
  }
})

onUnmounted(() => {
  if (tabsContext?.unregisterTab && props.value !== undefined) {
    tabsContext.unregisterTab(props.value)
  }
})

// Update registration when label changes
watch(
  () => [props.title, tabElementRef.value?.textContent],
  () => {
    if (tabsContext?.registerTab && props.value !== undefined) {
      tabsContext.registerTab(props.value, getTabLabel(), tabElementRef.value)
    }
  },
)
</script>

<style>
.m-tab {
  position: relative;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  min-width: 90px;
  max-width: 360px;
  height: 48px;
  padding: 0 24px;
  background-color: transparent !important;
  border: none;
  border-bottom: 3px solid transparent;
  outline: none;
  cursor: pointer;
  user-select: none;
  transition:
    color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    border-bottom-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
  box-sizing: border-box;
}

.m-tab:hover:not(.m-tab--disabled) {
  color: rgba(var(--v-theme-on-surface), 0.87) !important;
}

.m-tab--selected {
  color: rgba(var(--v-theme-on-surface), 0.87) !important;
  font-weight: 500 !important;
}

.m-tab--selected .m-tab__indicator {
  display: none !important;
}

.m-tab--disabled {
  opacity: 0.38;
  cursor: default;
  pointer-events: none;
}

.m-tab--fixed {
  flex: 1 1 auto;
  min-width: 0;
}

.m-tab--stacked {
  flex-direction: column;
  height: 72px;
  padding: 8px 16px;
}

.m-tab__wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 100%;
}

.m-tab__prepend,
.m-tab__append {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.m-tab__content {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.875rem !important;
  font-weight: 500 !important;
  line-height: 1.75 !important;
  letter-spacing: 0.02857em !important;
  text-transform: uppercase !important;
  color: inherit;
  transition: color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.m-tab--selected .m-tab__content {
  /* Color will be set via inline style, this is just a fallback */
  color: var(--primary);
}

.m-tab__indicator {
  position: absolute !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  height: 2px !important;
  background-color: var(--primary) !important;
  transform-origin: center;
  transform: scaleX(0);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 2px 2px 0 0;
  z-index: 1;
}

/* Indicator is hidden when tab is selected (we use border instead) */
.m-tab--selected .m-tab__indicator {
  display: none !important;
}

.m-tab--stacked .m-tab__wrapper {
  flex-direction: column;
  gap: 4px;
}

/* Focus styles */
.m-tab:focus-visible {
  outline: 2px solid rgba(var(--v-theme-primary), 0.5);
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
