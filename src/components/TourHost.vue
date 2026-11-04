<!--
  TourHost: shows the guided tour the help menu started, one step at a time, with CoreTour. Below
  the text the card lists the terms the step explains and shows its example.
-->
<template>
  <CoreTour
    v-if="tour && step"
    :target="target"
    :title="t(texts.title, { app: appName })"
    :text="t(texts.text, { app: appName })"
    :index="index"
    :count="steps.length"
    :progress-label="t('onboarding.progress', { current: index + 1, total: steps.length })"
    :back-label="t('onboarding.back')"
    :next-label="t('onboarding.next')"
    :done-label="t('onboarding.done')"
    :close-label="t('onboarding.close')"
    @back="back"
    @next="next"
    @close="stop"
  >
    <div v-if="step.example" class="tour-host__example" inert data-testid="tour-example">
      <component :is="step.example" />
    </div>
    <dl v-if="terms.length" class="tour-host__terms" data-testid="tour-terms">
      <div v-for="term in terms" :key="term.title" class="tour-host__term">
        <dt>{{ term.title }}</dt>
        <dd>{{ term.text }}</dd>
      </div>
    </dl>
  </CoreTour>
</template>

<script setup lang="ts">
import { computed, nextTick, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreTour from '@cornflow-ui/core/components/core/CoreTour.vue'
import config from '@cornflow-ui/core/config'
import {
  stepTextKeys,
  termTextKeys,
  type TourStep,
  type TourTerm,
} from '@cornflow-ui/core/composables/onboarding/tours'
import { tourTarget, tourTermsOf, useTour } from '@cornflow-ui/core/composables/onboarding/useTour'

defineOptions({ name: 'TourHost' })

const { t } = useI18n()
const { tour, steps, step, index, next, back, skip, stop } = useTour()

const appName = computed(() => config.name || 'Cornflow')
const texts = computed(() => stepTextKeys(tour.value!, step.value!))

const terms = computed<TourTerm[]>(() => {
  const current = step.value
  if (!current) return []
  if (!current.terms) return tourTermsOf(current.target)
  return current.terms.map((term) => {
    const keys = termTextKeys(tour.value!, current, term)
    return { title: t(keys.title), text: t(keys.text) }
  })
})

/** Frames a step waits for the part it opens (a menu, a panel) to show its element. */
const WAIT_FRAMES = 30

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))

/** The element of the step, once what the step opens is on the screen; null if it never shows. */
async function findTarget(current: TourStep): Promise<HTMLElement | null> {
  await nextTick()
  for (let waited = 0; waited < WAIT_FRAMES && step.value === current; waited++) {
    const element = tourTarget(current)
    if (element) return element
    await frame()
  }
  return tourTarget(current)
}

const target = shallowRef<HTMLElement | null>(null)

watch(
  step,
  async (current) => {
    if (!current?.target) {
      target.value = null
      return
    }
    const element = await findTarget(current)
    if (step.value !== current) return
    if (element) target.value = element
    else skip()
  },
  { immediate: true },
)

// Once the tour ends, the focus goes back to the help button it was started from.
watch(tour, (current, previous) => {
  if (previous && !current) document.querySelector<HTMLElement>('[data-tour="help-menu"]')?.focus()
})
</script>

<style scoped>
.tour-host__example {
  padding: calc(var(--spacing) * 2);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-background);
}

.tour-host__terms {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
  margin: 0;
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
}

.tour-host__term dt {
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.tour-host__term dd {
  margin: 0;
  color: var(--color-text-muted);
  text-wrap: pretty;
}
</style>
