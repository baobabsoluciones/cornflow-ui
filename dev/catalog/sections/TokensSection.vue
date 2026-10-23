<template>
  <section class="tokens">
    <h1 class="tokens__title">Design tokens</h1>
    <p class="tokens__lead">
      Defined in <code>src/assets/styles/tokens.css</code>. Colours come from
      the app's <code>variables.css</code>; try another primary in the side bar.
    </p>

    <h2 class="tokens__heading">Colour</h2>
    <div class="tokens__swatches">
      <div v-for="token in colorTokens" :key="token" class="swatch">
        <div class="swatch__chip" :style="{ background: `var(${token})` }" />
        <code class="swatch__name">{{ token }}</code>
        <code class="swatch__value">{{ values[token] }}</code>
      </div>
    </div>

    <h2 class="tokens__heading">Tones</h2>
    <p class="tokens__note">
      Each tone has a base colour, a soft background, a border for it and the
      text that reads on it. Soft and border mix the base with white, so they
      follow the app's palette.
    </p>
    <div class="tokens__swatches">
      <div v-for="token in toneTokens" :key="token" class="swatch">
        <div class="swatch__chip" :style="{ background: `var(${token})` }" />
        <code class="swatch__name">{{ token }}</code>
        <code class="swatch__value">{{ values[token] }}</code>
      </div>
    </div>

    <h2 class="tokens__heading">Vuetify follows the primary</h2>
    <p class="tokens__note">
      Vuetify components with <code>color="primary"</code> paint with
      <code>--color-primary</code>.
    </p>
    <div class="tokens__row">
      <v-btn color="primary">Vuetify button</v-btn>
      <v-chip color="primary" variant="flat">Chip</v-chip>
      <v-progress-circular color="primary" indeterminate />
      <v-switch
        color="primary"
        :model-value="true"
        hide-details
        label="Switch"
      />
    </div>

    <h2 class="tokens__heading">Type</h2>
    <div class="tokens__list">
      <div v-for="token in textTokens" :key="token" class="type-sample">
        <code class="type-sample__name">{{ token }} · {{ values[token] }}</code>
        <span :style="{ fontSize: `var(${token})` }"
          >Plan semana 42 · Planta Norte</span
        >
      </div>
      <div v-for="token in weightTokens" :key="token" class="type-sample">
        <code class="type-sample__name">{{ token }} · {{ values[token] }}</code>
        <span :style="{ fontWeight: `var(${token})` }"
          >Plan semana 42 · Planta Norte</span
        >
      </div>
    </div>

    <h2 class="tokens__heading">Spacing</h2>
    <p class="tokens__note">
      One base unit, <code>--spacing</code> ({{ values['--spacing'] }}); sizes
      are its multiples, e.g. <code>calc(var(--spacing) * 4)</code>.
    </p>
    <div class="tokens__list">
      <div v-for="step in spacingSteps" :key="step" class="spacing-sample">
        <code class="type-sample__name">× {{ step }}</code>
        <div
          class="spacing-sample__bar"
          :style="{ width: `calc(var(--spacing) * ${step})` }"
        />
      </div>
    </div>

    <h2 class="tokens__heading">Radii and shadows</h2>
    <div class="tokens__swatches">
      <div v-for="token in radiusTokens" :key="token" class="swatch">
        <div class="swatch__box" :style="{ borderRadius: `var(${token})` }" />
        <code class="swatch__name">{{ token }}</code>
        <code class="swatch__value">{{ values[token] }}</code>
      </div>
      <div v-for="token in shadowTokens" :key="token" class="swatch">
        <div
          class="swatch__box swatch__box--shadow"
          :style="{ boxShadow: `var(${token})` }"
        />
        <code class="swatch__name">{{ token }}</code>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive } from 'vue'
import { readCssToken } from '@cornflow-ui/core/plugins/vuetify'

const colorTokens = [
  '--color-primary',
  '--color-primary-light',
  '--color-primary-soft',
  '--color-primary-subtle',
  '--color-on-primary',
  '--color-secondary',
  '--color-text',
  '--color-text-muted',
  '--color-text-subtle',
  '--color-background',
  '--color-surface',
  '--color-surface-muted',
  '--color-surface-hover',
  '--color-inverse',
  '--color-border',
  '--color-border-subtle',
  '--color-border-input',
  '--color-border-strong',
  '--color-divider',
  '--color-disabled',
]
const toneTokens = ['success', 'warning', 'danger', 'info', 'neutral'].flatMap(
  (tone) =>
    ['', '-soft', '-border', '-strong'].map((part) => `--color-${tone}${part}`),
)
const textTokens = [
  '--text-xs',
  '--text-sm',
  '--text-md',
  '--text-base',
  '--text-lg',
  '--text-xl',
  '--text-2xl',
]
const weightTokens = [
  '--font-weight-regular',
  '--font-weight-medium',
  '--font-weight-bold',
]
const radiusTokens = [
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--radius-xl',
  '--radius-full',
]
const shadowTokens = [
  '--shadow-sm',
  '--shadow-md',
  '--shadow-lg',
  '--shadow-xl',
]
const spacingSteps = [1, 2, 3, 4, 6, 8, 12, 16]

const allTokens = [
  ...colorTokens,
  ...toneTokens,
  ...textTokens,
  ...weightTokens,
  ...radiusTokens,
  '--spacing',
]
const values = reactive<Record<string, string>>({})

function readValues() {
  for (const token of allTokens) values[token] = readCssToken(token)
}

// The side bar changes `--primary` on body: read the resolved values again.
const observer = new MutationObserver(readValues)
onMounted(() => {
  readValues()
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['style'],
  })
})
onUnmounted(() => observer.disconnect())
</script>

<style scoped>
.tokens {
  max-width: 1100px;
}

.tokens__title {
  margin: 0 0 calc(var(--spacing) * 2);
  font-size: var(--text-2xl);
  font-weight: var(--font-weight-bold);
}

.tokens__lead,
.tokens__note {
  margin: 0 0 calc(var(--spacing) * 4);
  color: var(--color-text-muted);
  font-size: var(--text-base);
}

.tokens__heading {
  margin: calc(var(--spacing) * 10) 0 calc(var(--spacing) * 4);
  font-size: var(--text-lg);
  font-weight: var(--font-weight-medium);
}

.tokens__swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: calc(var(--spacing) * 4);
}

.tokens__row {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 6);
}

.tokens__list {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3);
}

.swatch {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1);
  padding: calc(var(--spacing) * 3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.swatch__chip {
  height: 56px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.swatch__box {
  height: 56px;
  background: var(--color-primary-soft);
  border: 1px solid var(--color-primary);
}

.swatch__box--shadow {
  background: var(--color-surface);
  border-color: transparent;
  border-radius: var(--radius-md);
}

.swatch__name {
  font-size: var(--text-sm);
}

.swatch__value {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.type-sample,
.spacing-sample {
  display: grid;
  grid-template-columns: 240px 1fr;
  align-items: center;
}

.type-sample__name {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.spacing-sample__bar {
  height: 12px;
  background: var(--color-primary);
  border-radius: var(--radius-sm);
}
</style>
