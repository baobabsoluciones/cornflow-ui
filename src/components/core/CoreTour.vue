<!--
  CoreTour: one step of a guided tour. It dims the window, lights up the element the step points
  at (`target`) and shows a card beside it with the title, the text, how far the tour has gone
  and the buttons to go back, on and out. Without `target` the card shows in the middle. The
  default slot goes below the text (terms, an example), and the card grows to hold it.

  The card takes the focus at each step. The arrows go back and on, Escape closes, and Tab stays
  within the card. The element is followed while it moves (scrolls, a menu that opens).

  <CoreTour
    :target="element"
    :title="step.title"
    :text="step.text"
    :index="index"
    :count="steps.length"
    progress-label="2 of 8"
    back-label="Back"
    next-label="Next"
    done-label="Done"
    close-label="Close the tour"
    @back="back"
    @next="next"
    @close="close"
  />
-->
<template>
  <Teleport to="body">
    <div class="core-tour" data-testid="core-tour">
      <div class="core-tour__blocker" />
      <div
        v-if="spotlight"
        class="core-tour__spotlight"
        :style="{
          top: `${spotlight.top}px`,
          left: `${spotlight.left}px`,
          width: `${spotlight.width}px`,
          height: `${spotlight.height}px`,
        }"
      />
      <div v-else class="core-tour__scrim" />
      <section
        ref="card"
        class="core-tour__card"
        :class="`is-${position.side}`"
        :style="{ top: `${position.top}px`, left: `${position.left}px` }"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="textId"
        tabindex="-1"
        data-testid="core-tour-card"
        @keydown="onKey"
      >
        <header class="core-tour__header">
          <h2 :id="titleId" class="core-tour__title">{{ title }}</h2>
          <button
            type="button"
            class="core-tour__close"
            :aria-label="closeLabel"
            :title="closeLabel"
            data-testid="core-tour-close"
            @click="emit('close')"
          >
            <CoreIcon name="mdi-close" :size="18" />
          </button>
        </header>
        <p :id="textId" class="core-tour__text">{{ text }}</p>
        <slot />
        <footer class="core-tour__footer">
          <span class="core-tour__progress" aria-live="polite">{{ progressLabel }}</span>
          <span class="core-tour__dots" aria-hidden="true">
            <span
              v-for="dot in count"
              :key="dot"
              class="core-tour__dot"
              :class="{ 'is-current': dot - 1 === index }"
            />
          </span>
          <CoreButton
            v-if="index > 0"
            variant="text"
            tone="neutral"
            size="small"
            :text="backLabel"
            data-testid="core-tour-back"
            @click="emit('back')"
          />
          <CoreButton
            variant="filled"
            size="small"
            :text="isLast ? doneLabel : nextLabel"
            data-testid="core-tour-next"
            @click="emit('next')"
          />
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import {
  tourCardPosition,
  tourSpotlight,
  type TourRect,
} from '@cornflow-ui/core/utils/tourPlacement'

defineOptions({ name: 'CoreTour' })

const props = defineProps<{
  /** The element the step points at; none for a step in the middle of the window. */
  target: HTMLElement | null
  title: string
  text: string
  /** The step shown, from 0. */
  index: number
  count: number
  progressLabel: string
  backLabel: string
  nextLabel: string
  doneLabel: string
  closeLabel: string
}>()

const emit = defineEmits<{
  back: []
  next: []
  close: []
}>()

const titleId = useId()
const textId = useId()
const card = useTemplateRef<HTMLElement>('card')

const isLast = computed(() => props.index >= props.count - 1)

const viewport = ref({ width: window.innerWidth, height: window.innerHeight })
const targetRect = ref<TourRect | null>(null)
const cardSize = ref({ width: 340, height: 180 })

const spotlight = computed(() =>
  targetRect.value ? tourSpotlight(targetRect.value, viewport.value) : null,
)
const position = computed(() =>
  tourCardPosition(spotlight.value, cardSize.value, viewport.value),
)

const sameRect = (a: TourRect | null, b: TourRect | null) =>
  a === b ||
  (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height)

/** Follows the element and the card, frame by frame, while the step is shown. */
let frame = 0
function measure() {
  const rect = props.target?.getBoundingClientRect()
  const next = rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null
  if (!sameRect(next, targetRect.value)) targetRect.value = next
  if (viewport.value.width !== window.innerWidth || viewport.value.height !== window.innerHeight) {
    viewport.value = { width: window.innerWidth, height: window.innerHeight }
  }
  const element = card.value
  if (element && (element.offsetWidth !== cardSize.value.width || element.offsetHeight !== cardSize.value.height)) {
    cardSize.value = { width: element.offsetWidth, height: element.offsetHeight }
  }
  frame = requestAnimationFrame(measure)
}

async function showStep() {
  props.target?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  await nextTick()
  card.value?.focus()
}

watch(() => [props.target, props.index], showStep)

onMounted(() => {
  measure()
  void showStep()
})
onBeforeUnmount(() => cancelAnimationFrame(frame))

/** The arrows go back and on, Escape closes, and Tab goes round the card's buttons. */
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    emit('next')
  } else if (event.key === 'ArrowLeft' && props.index > 0) {
    event.preventDefault()
    emit('back')
  } else if (event.key === 'Tab') {
    const buttons = [...(card.value?.querySelectorAll<HTMLElement>('button') ?? [])]
    if (buttons.length === 0) return
    const current = buttons.indexOf(document.activeElement as HTMLElement)
    const step = event.shiftKey ? -1 : 1
    const next = current === -1 ? (event.shiftKey ? buttons.length - 1 : 0) : (current + step + buttons.length) % buttons.length
    event.preventDefault()
    buttons[next].focus()
  }
}
</script>

<style scoped>
.core-tour__blocker {
  position: fixed;
  inset: 0;
  z-index: var(--z-dialog);
}

.core-tour__scrim {
  position: fixed;
  inset: 0;
  z-index: var(--z-dialog);
  background: var(--color-scrim);
}

.core-tour__spotlight {
  position: fixed;
  z-index: var(--z-dialog);
  border-radius: var(--radius-lg);
  box-shadow:
    0 0 0 2px var(--color-primary),
    0 0 0 9999px var(--color-scrim);
  pointer-events: none;
  transition:
    top var(--duration-base) var(--ease-standard),
    left var(--duration-base) var(--ease-standard),
    width var(--duration-base) var(--ease-standard),
    height var(--duration-base) var(--ease-standard);
}

.core-tour__card {
  position: fixed;
  z-index: var(--z-dialog);
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2);
  width: 340px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  box-sizing: border-box;
  padding: calc(var(--spacing) * 5);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-xl);
  font-family: var(--font-sans);
  color: var(--color-text);
  outline: none;
  transition:
    top var(--duration-base) var(--ease-standard),
    left var(--duration-base) var(--ease-standard);
}

.core-tour__header {
  display: flex;
  align-items: flex-start;
  gap: calc(var(--spacing) * 2);
}

.core-tour__title {
  flex: 1;
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--font-weight-medium);
  line-height: var(--leading-tight);
  color: var(--color-primary);
}

.core-tour__close {
  display: inline-flex;
  margin: calc(var(--spacing) * -1) calc(var(--spacing) * -1) 0 0;
  padding: calc(var(--spacing) * 1);
  border: 0;
  border-radius: var(--radius-md);
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
}

.core-tour__close:hover {
  background: var(--color-surface-hover);
}

.core-tour__close:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.core-tour__text {
  margin: 0;
  font-size: var(--text-md);
  line-height: var(--leading-normal);
  color: var(--color-text-muted);
  text-wrap: pretty;
}

.core-tour__footer {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  margin-top: calc(var(--spacing) * 2);
}

.core-tour__progress {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.core-tour__dots {
  display: flex;
  flex: 1;
  gap: calc(var(--spacing) * 1);
}

.core-tour__dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--color-border-strong);
}

.core-tour__dot.is-current {
  width: 16px;
  background: var(--color-primary);
}

@media (prefers-reduced-motion: reduce) {
  .core-tour__spotlight,
  .core-tour__card {
    transition: none;
  }
}
</style>
