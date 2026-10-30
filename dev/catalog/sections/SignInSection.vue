<template>
  <div class="catalog-section">
    <h1 class="catalog-section__title">Sign-in</h1>
    <p class="catalog-section__lead">
      The sign-in page and its pieces (<code>src/components/sign-in/</code>). The layout comes from
      <code>login.layout</code> in the app config; here the buttons set it in the store, as the app
      reads it.
    </p>

    <CatalogBlock
      name="SignInLanding"
      api="login.layout (photo | brand) · login.subtitle · login.description"
      note="Photo: the login background behind a card. Brand: a panel in the primary colour beside the form."
    >
      <div class="stack">
        <div class="row">
          <CoreButton
            v-for="option in layouts"
            :key="option"
            size="small"
            :variant="layout === option ? 'filled' : 'outlined'"
            :text="option"
            @click="setLayout(option)"
          />
        </div>
        <div class="page-frame">
          <SignInLanding />
        </div>
      </div>
    </CatalogBlock>

    <CatalogBlock name="SignInForm" api="compact">
      <div class="sample">
        <span class="caption">Default (photo layout)</span>
        <div class="form-frame">
          <SignInForm />
        </div>
      </div>
      <div class="sample">
        <span class="caption">Compact (brand layout)</span>
        <div class="form-frame">
          <SignInForm compact />
        </div>
      </div>
    </CatalogBlock>

    <CatalogBlock
      name="SignInLanguages"
      note="The languages of the app config, the current one in bold; with a single language it shows nothing."
    >
      <SignInLanguages />
    </CatalogBlock>
  </div>
</template>

<script setup lang="ts">
// The routes import the login view, and the sign-in form reaches them through the auth services:
// loading the routes first lets that cycle resolve as it does in the app.
import '@cornflow-ui/core/router'
import { computed, onBeforeUnmount } from 'vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import SignInLanding from '@cornflow-ui/core/components/SignInLanding.vue'
import SignInForm from '@cornflow-ui/core/components/sign-in/SignInForm.vue'
import SignInLanguages from '@cornflow-ui/core/components/sign-in/SignInLanguages.vue'
import type { LoginLayout } from '@/app/config'
import config from '@cornflow-ui/core/config'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import CatalogBlock from '../CatalogBlock.vue'

const layouts: LoginLayout[] = ['photo', 'brand']

/** The title of the page is the app name: a sample one while shown here, if the app has none. */
const savedName = config.name
config.name = savedName || 'Planner Pro'
onBeforeUnmount(() => {
  config.name = savedName
})

const store = useGeneralStore()
const layout = computed(() => store.appConfig.parameters.login?.layout ?? 'photo')

function setLayout(value: LoginLayout) {
  store.appConfig.parameters.login = {
    ...store.appConfig.parameters.login,
    layout: value,
    description:
      store.appConfig.parameters.login?.description ||
      'Plans the week of every plant in minutes, with the data of the day.',
  }
}
</script>

<style scoped>
.catalog-section__lead {
  margin: 0;
  color: var(--color-text-muted);
}

.stack {
  flex: 1 1 100%;
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3);
  min-width: 0;
}

.row {
  display: flex;
  gap: calc(var(--spacing) * 2);
}

/* The page fills the window: inside the frame it takes the frame's height instead. */
.page-frame {
  height: 760px;
  overflow: hidden;
  transform: translateZ(0);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
}

.page-frame :deep(.sign-in) {
  height: 100%;
}

.sample {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2);
}

.form-frame {
  width: 380px;
  padding: calc(var(--spacing) * 6);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
}

.caption {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}
</style>
