<!--
  CoreSearchInput: a search box.

  - `update:modelValue` on every keystroke; `search` after `debounce` ms.
  - ⌘K / Ctrl+K focuses it (with `showShortcut`, which also shows the hint while empty).
  - Escape clears it; with `clearable`, a cross does too.
  - `block` makes it take the full width; otherwise it stops at 320px.

  <CoreSearchInput v-model="text" placeholder="Search…" @search="find" />
-->
<template>
  <div class="core-search-input" :class="{ 'core-search-input--block': block }">
    <div
      class="core-search-input__container"
      :class="{ 'is-disabled': disabled }"
    >
      <CoreIcon name="mdi-magnify" :size="18" class="core-search-input__icon" />

      <input
        ref="inputRef"
        :value="modelValue"
        :placeholder="placeholder"
        :aria-label="placeholder"
        :disabled="disabled"
        class="core-search-input__field"
        type="text"
        autocomplete="off"
        spellcheck="false"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeydown"
      />

      <div
        v-if="showShortcut && !modelValue && !isFocused"
        class="core-search-input__shortcut"
        aria-hidden="true"
      >
        <span class="core-search-input__shortcut-key">{{ shortcutKey }}</span>
        <span class="core-search-input__shortcut-key">K</span>
      </div>

      <button
        v-if="clearable && modelValue && modelValue.length > 0"
        type="button"
        class="core-search-input__clear"
        :aria-label="$t('common.clear')"
        :title="$t('common.clear')"
        @click="handleClear"
      >
        <CoreIcon name="mdi-close-circle" :size="16" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'

interface Props {
  modelValue?: string
  placeholder?: string
  debounce?: number
  showShortcut?: boolean
  disabled?: boolean
  clearable?: boolean
  block?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Search',
  debounce: 300,
  showShortcut: true,
  disabled: false,
  clearable: true,
  block: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: [value: string]
  clear: []
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

const isFocused = ref(false)
const debounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const inputRef = ref<HTMLInputElement>()

const shortcutKey = computed(() =>
  navigator.platform.toUpperCase().includes('MAC') ? '⌘' : 'Ctrl',
)

const handleInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value
  emit('update:modelValue', value)

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
  if (event.key === 'Escape') {
    handleClear()
    ;(event.target as HTMLInputElement).blur()
  }
}

const handleGlobalKeydown = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
    event.preventDefault()
    focusInput()
  }
}

const handleClear = () => {
  emit('update:modelValue', '')
  emit('clear')
  emit('search', '')

  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }
}

const focusInput = () => {
  inputRef.value?.focus()
}

// The shortcut listens on the document only while `showShortcut` is on.
const listenForShortcut = (on: boolean) => {
  if (on) document.addEventListener('keydown', handleGlobalKeydown)
  else document.removeEventListener('keydown', handleGlobalKeydown)
}

watch(() => props.showShortcut, listenForShortcut)

onMounted(() => listenForShortcut(props.showShortcut))

onBeforeUnmount(() => {
  listenForShortcut(false)
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

.core-search-input--block {
  max-width: none;
}

.core-search-input__container {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  height: 36px;
  box-sizing: border-box;
  padding: 0 calc(var(--spacing) * 2.5) 0 calc(var(--spacing) * 3);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-family: var(--font-sans);
  transition: border-color var(--duration-base) var(--ease-standard);
}

.core-search-input__container:hover {
  border-color: var(--color-border-strong);
}

.core-search-input__container:focus-within {
  border-color: var(--color-primary);
}

.core-search-input__container.is-disabled {
  background: var(--color-disabled);
  opacity: 0.7;
}

.core-search-input__icon {
  color: var(--color-text-muted);
}

.core-search-input__field {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: var(--text-md);
  color: var(--color-text);
}

.core-search-input__field::placeholder {
  color: var(--color-text-subtle);
}

.core-search-input__shortcut {
  display: flex;
  gap: 2px;
}

.core-search-input__shortcut-key {
  padding: 1px 5px;
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.core-search-input__clear {
  display: inline-flex;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-text-subtle);
  cursor: pointer;
}

.core-search-input__clear:hover {
  color: var(--color-text-muted);
}

.core-search-input__clear:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-full);
}
</style>
