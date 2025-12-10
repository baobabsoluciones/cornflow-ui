<!--
/**
 * CoreSearchInput component
 *
 * A reusable search input component with consistent look and feel across the application.
 *
 * Features:
 * - Clean, modern design with search icon
 * - Keyboard shortcut support (⌘+K / Ctrl+K)
 * - Placeholder text with shortcut hint
 * - Debounced input for performance
 * - Clear button when text is present
 * - Responsive design
 * - Accessibility support
 *
 * Props:
 * - modelValue (String): Search text value
 * - placeholder (String): Placeholder text
 * - debounce (Number): Debounce delay in milliseconds
 * - showShortcut (Boolean): Show keyboard shortcut hint
 * - disabled (Boolean): Disable input
 * - clearable (Boolean): Show clear button
 *
 * Usage examples:
 *
 * Basic search:
 * <CoreSearchInput
 *   v-model="searchText"
 *   placeholder="Search..."
 *   @search="handleSearch"
 * />
 *
 * With keyboard shortcut:
 * <CoreSearchInput
 *   v-model="searchText"
 *   placeholder="Search"
 *   :show-shortcut="true"
 *   @search="handleSearch"
 * />
 *
 * With custom debounce:
 * <CoreSearchInput
 *   v-model="searchText"
 *   :debounce="500"
 *   @search="handleSearch"
 * />
 *
 * Events:
 * - @update:modelValue: Emitted when input value changes
 * - @search: Emitted after debounce delay with search text
 * - @clear: Emitted when clear button is clicked
 * - @focus: Emitted when input is focused
 * - @blur: Emitted when input loses focus
 */
-->

<template>
  <div class="core-search-input">
    <div class="core-search-input__container">
      <!-- Search Icon -->
      <v-icon icon="mdi-magnify" class="core-search-input__icon" size="20" />

      <!-- Input Field -->
      <input
        ref="inputRef"
        :value="modelValue"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeydown"
        :placeholder="computedPlaceholder"
        :disabled="disabled"
        class="core-search-input__field"
        type="text"
        autocomplete="off"
        spellcheck="false"
      />

      <!-- Keyboard Shortcut Hint -->
      <div
        v-if="showShortcut && !modelValue && !isFocused"
        class="core-search-input__shortcut"
      >
        <span class="core-search-input__shortcut-key">{{ shortcutKey }}</span>
        <span class="core-search-input__shortcut-plus">+</span>
        <span class="core-search-input__shortcut-key">K</span>
      </div>

      <!-- Clear Button -->
      <v-btn
        v-if="clearable && modelValue && modelValue.length > 0"
        icon="mdi-close"
        variant="text"
        size="small"
        class="core-search-input__clear"
        @click="handleClear"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

// Props
interface Props {
  modelValue?: string
  placeholder?: string
  debounce?: number
  showShortcut?: boolean
  disabled?: boolean
  clearable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Search',
  debounce: 300,
  showShortcut: true,
  disabled: false,
  clearable: true,
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: [value: string]
  clear: []
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

// State
const isFocused = ref(false)
const debounceTimer = ref<number | null>(null)
const inputRef = ref<HTMLInputElement>()

// Computed
const computedPlaceholder = computed(() => {
  return props.showShortcut && !isFocused.value
    ? props.placeholder
    : props.placeholder
})

const shortcutKey = computed(() => {
  // Detect if user is on Mac
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl'
})

// Methods
const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  const value = target.value
  emit('update:modelValue', value)

  // Debounced search
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }

  debounceTimer.value = setTimeout(() => {
    emit('search', value)
  }, props.debounce)
}

const handleFocus = (event: FocusEvent) => {
  isFocused.value = true
  emit('focus', event)
}

const handleBlur = (event: FocusEvent) => {
  isFocused.value = false
  emit('blur', event)
}

const handleKeydown = (event: KeyboardEvent) => {
  // Handle Escape key to clear search
  if (event.key === 'Escape') {
    handleClear()
    ;(event.target as HTMLInputElement).blur()
  }
}

const handleGlobalKeydown = (event: KeyboardEvent) => {
  // Handle Cmd+K / Ctrl+K shortcut
  if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
    event.preventDefault()
    focusInput()
  }
}

const handleClear = () => {
  emit('update:modelValue', '')
  emit('clear')
  emit('search', '')

  // Clear debounce timer
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }
}

const focusInput = () => {
  inputRef.value?.focus()
}

// Lifecycle
onMounted(() => {
  // Add global keyboard shortcut listener
  if (props.showShortcut) {
    document.addEventListener('keydown', handleGlobalKeydown)
  }
})

onBeforeUnmount(() => {
  // Clean up event listener and timer
  if (props.showShortcut) {
    document.removeEventListener('keydown', handleGlobalKeydown)
  }
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }
})
</script>

<style scoped>
.core-search-input {
  width: 100%;
  max-width: 320px;
}

.core-search-input__container {
  position: relative;
  display: flex;
  align-items: center;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 0 12px;
  height: 40px;
  transition: all 0.2s ease;
}

.core-search-input__container:hover {
  border-color: #bdbdbd;
}

.core-search-input__container:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(9, 132, 198, 0.1);
}

.core-search-input__icon {
  color: var(--subtitle);
  margin-right: 8px;
  flex-shrink: 0;
}

.core-search-input__field {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  line-height: 1.4;
  color: var(--title);
  padding: 0;
  margin: 0;
}

.core-search-input__field::placeholder {
  color: var(--subtitle);
}

.core-search-input__field:disabled {
  color: var(--disabled);
  cursor: not-allowed;
}

.core-search-input__shortcut {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 8px;
  flex-shrink: 0;
}

.core-search-input__shortcut-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  background: var(--background);
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--subtitle);
  padding: 0 4px;
}

.core-search-input__shortcut-plus {
  font-size: 11px;
  color: var(--subtitle);
  font-weight: 500;
}

.core-search-input__clear {
  margin-left: 4px;
  flex-shrink: 0;
}

.core-search-input__clear :deep(.v-btn__content) {
  color: var(--subtitle);
}

.core-search-input__clear:hover :deep(.v-btn__content) {
  color: var(--title);
}

/* Disabled state */
.core-search-input__container:has(.core-search-input__field:disabled) {
  background: var(--disabled);
  border-color: #e0e0e0;
  cursor: not-allowed;
}

.core-search-input__container:has(.core-search-input__field:disabled)
  .core-search-input__icon {
  color: var(--subtitle);
}

/* Responsive design */
@media (max-width: 600px) {
  .core-search-input {
    max-width: 100%;
  }

  .core-search-input__shortcut {
    display: none;
  }
}

/* Light mode only - using variables.css colors */
</style>
