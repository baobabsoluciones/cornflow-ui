<!--
  TourHost: shows the guided tour the help menu started, one step at a time, with CoreTour.
-->
<template>
  <CoreTour
    v-if="tour && step"
    :target="tourTarget(step)"
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
  />
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreTour from '@cornflow-ui/core/components/core/CoreTour.vue'
import config from '@cornflow-ui/core/config'
import { stepTextKeys } from '@cornflow-ui/core/composables/onboarding/tours'
import { tourTarget, useTour } from '@cornflow-ui/core/composables/onboarding/useTour'

defineOptions({ name: 'TourHost' })

const { t } = useI18n()
const { tour, steps, step, index, next, back, stop } = useTour()

const appName = computed(() => config.name || 'Cornflow')
const texts = computed(() => stepTextKeys(tour.value!, step.value!))

// Once the tour ends, the focus goes back to the help button it was started from.
watch(tour, (current, previous) => {
  if (previous && !current) document.querySelector<HTMLElement>('[data-tour="help-menu"]')?.focus()
})
</script>
