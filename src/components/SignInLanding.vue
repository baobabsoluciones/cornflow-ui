<!--
  SignInLanding: the sign-in page, in one of two layouts (`login.layout` in the app config):

  - `photo` (default): the app's login background fills the window; the sign-in form sits on a
    white card on the right, and the app's full logo and the product mark on a small card at the
    bottom left.
  - `brand`: a panel in the app's primary colour on the left, with the company logo (in white), the
    app name and its description; the sign-in form on the right.

  The app name is split in two (bold first word); `login.subtitle` and `login.description` are
  texts or i18n keys of the app.
-->
<template>
  <div
    v-if="layout === 'brand'"
    class="sign-in sign-in--brand"
    data-testid="sign-in-brand"
  >
    <aside class="sign-in__brand-panel">
      <img class="sign-in__brand-logo" :src="companyLogo" alt="" />
      <div class="sign-in__brand-claim">
        <span class="sign-in__brand-accent" />
        <h1 class="sign-in__brand-title">
          <span class="is-bold">{{ appTitle.first }}</span>{{ appTitle.rest }}
        </h1>
        <p v-if="description" class="sign-in__brand-description">{{ description }}</p>
      </div>
      <div class="sign-in__brand-product">
        <BaobabMark class="sign-in__brand-mark" />
        <span>{{ PRODUCT }} · baobab soluciones</span>
      </div>
    </aside>
    <main class="sign-in__brand-form">
      <div class="sign-in__body">
        <header class="sign-in__heading">
          <h2 class="sign-in__title">{{ $t('logIn.button_label') }}</h2>
          <p class="sign-in__subtitle">{{ subtitle }}</p>
        </header>
        <SignInForm compact />
      </div>
      <footer class="sign-in__footer is-end">
        <SignInLanguages />
      </footer>
    </main>
  </div>

  <div
    v-else
    class="sign-in sign-in--photo"
    :style="{ '--sign-in-background': `url(${loginBackground})` }"
    data-testid="sign-in-photo"
  >
    <div class="sign-in__marks">
      <img class="sign-in__marks-company" :src="fullLogo" alt="" />
      <span class="sign-in__marks-divider" />
      <span class="sign-in__marks-product">
        <BaobabMark class="sign-in__marks-mark" />
        {{ PRODUCT }}
      </span>
    </div>
    <main class="sign-in__card">
      <div class="sign-in__body">
        <header class="sign-in__heading">
          <h1 class="sign-in__app-title">
            <span class="is-bold">{{ appTitle.first }}</span> {{ appTitle.rest }}
          </h1>
          <p class="sign-in__subtitle">{{ subtitle }}</p>
        </header>
        <SignInForm />
      </div>
      <footer class="sign-in__footer">
        <span>{{ $t('logIn.powered_by') }}</span>
        <SignInLanguages />
      </footer>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import config from '@cornflow-ui/core/config'
import SignInForm from '@cornflow-ui/core/components/sign-in/SignInForm.vue'
import SignInLanguages from '@cornflow-ui/core/components/sign-in/SignInLanguages.vue'
import { getAppParameters } from '@cornflow-ui/core/utils/appParameters'
import BaobabMark from '@cornflow-ui/core/components/BaobabMark.vue'
import { companyLogo, fullLogo, loginBackground } from '@cornflow-ui/core/utils/assets'

defineOptions({ name: 'SignInLanding' })

/** The product the apps are part of. */
const PRODUCT = 'DecisionOps'

const { t, te } = useI18n()

const login = computed(() => getAppParameters().login)
const layout = computed(() => login.value?.layout ?? 'photo')

/** A text of the app: an i18n key, or the text itself. */
const appText = (value?: string | null) => (value && te(value) ? t(value) : value || '')

const subtitle = computed(() => appText(login.value?.subtitle) || t('logIn.default_subtitle'))
const description = computed(() => appText(login.value?.description))

/** The app name, split after its first word ("Planner Pro") or its first capital ("PlannerPro"). */
const appTitle = computed(() => {
  const name = config.name || ''
  const space = name.indexOf(' ')
  if (space > 0) return { first: name.slice(0, space), rest: name.slice(space + 1) }
  const camel = name.match(/^([A-Z][a-z0-9]+)([A-Z].*)$/)
  if (camel) return { first: camel[1], rest: camel[2] }
  return { first: name, rest: '' }
})
</script>

<style scoped>
.sign-in {
  box-sizing: border-box;
  min-height: 100vh;
  font-family: var(--font-sans);
  color: var(--color-text);
}

.is-bold {
  font-weight: var(--font-weight-bold);
}

.sign-in__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: calc(var(--spacing) * 7);
}

.sign-in__heading {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2);
}

.sign-in__heading h1,
.sign-in__heading h2,
.sign-in__heading p {
  margin: 0;
}

.sign-in__subtitle {
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--color-text-muted);
  text-wrap: pretty;
}

.sign-in__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--spacing) * 4);
  padding: calc(var(--spacing) * 5) 0;
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
}

.sign-in__footer.is-end {
  justify-content: flex-end;
}

/* ── Photo ──────────────────────────────────────────────────────────────── */

.sign-in--photo {
  position: relative;
  height: 100vh;
  min-height: 640px;
  overflow: hidden;
  background: var(--sign-in-background) 30% center / cover no-repeat var(--color-primary);
}

.sign-in--photo::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 40%,
    color-mix(in srgb, var(--color-primary) 35%, transparent) 100%
  );
}

.sign-in__marks {
  position: absolute;
  left: 40px;
  bottom: 40px;
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 5);
  padding: calc(var(--spacing) * 3.5) calc(var(--spacing) * 5);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-surface) 94%, transparent);
}

.sign-in__marks-company {
  height: 32px;
  max-width: 160px;
  object-fit: contain;
}

.sign-in__marks-divider {
  width: 1px;
  height: 32px;
  background: var(--color-divider);
}

.sign-in__marks-product {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  font-size: var(--text-base);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.06em;
}

.sign-in__marks-mark {
  height: 28px;
  width: auto;
  color: var(--color-baobab-mark);
}

/* As tall as its content, centred on the right; it scrolls only on a short window. */
.sign-in__card {
  position: absolute;
  top: 50%;
  right: 40px;
  transform: translateY(-50%);
  box-sizing: border-box;
  width: 480px;
  max-height: calc(100% - 80px);
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 10);
  padding: 48px 56px 0;
  overflow-y: auto;
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-xl);
}

.sign-in__card .sign-in__footer {
  border-top: 1px solid var(--color-divider);
}

.sign-in__app-title {
  font-size: 1.75rem;
  font-weight: 300;
  line-height: 1.2;
}

/* ── Brand ──────────────────────────────────────────────────────────────── */

.sign-in--brand {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 600px;
  height: 100vh;
  min-height: 640px;
  background: var(--color-surface);
}

.sign-in__brand-panel {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 56px 72px;
  background: var(--color-primary);
  color: var(--color-on-primary);
}

/* Any company logo reads on the primary colour once turned white. */
.sign-in__brand-logo {
  filter: brightness(0) invert(1);
}

.sign-in__brand-logo {
  align-self: flex-start;
  height: 40px;
  max-width: 220px;
  object-fit: contain;
  object-position: left;
}

.sign-in__brand-claim {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 5);
  max-width: 560px;
}

.sign-in__brand-accent {
  width: 48px;
  height: 4px;
  border-radius: 2px;
  background: var(--color-secondary);
}

.sign-in__brand-title {
  margin: 0;
  font-size: 3.5rem;
  font-weight: 300;
  line-height: 1.05;
  letter-spacing: -0.01em;
}

.sign-in__brand-description {
  margin: 0;
  font-size: 1.0625rem;
  line-height: 1.55;
  color: color-mix(in srgb, var(--color-on-primary) 85%, transparent);
  text-wrap: pretty;
}

.sign-in__brand-product {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 3);
  font-size: var(--text-md);
  color: color-mix(in srgb, var(--color-on-primary) 80%, transparent);
}

.sign-in__brand-mark {
  height: 26px;
  width: auto;
  color: var(--color-on-primary);
}

.sign-in__brand-form {
  display: flex;
  flex-direction: column;
  padding: 0 104px;
  overflow-y: auto;
}

.sign-in__title {
  font-size: 1.625rem;
  font-weight: var(--font-weight-medium);
}

/* ── Narrow screens ─────────────────────────────────────────────────────── */

@media (max-width: 1100px) {
  .sign-in--brand {
    grid-template-columns: minmax(0, 1fr) 480px;
  }

  .sign-in__brand-panel {
    padding: 48px;
  }

  .sign-in__brand-form {
    padding: 0 56px;
  }
}

@media (max-width: 860px) {
  .sign-in--brand {
    grid-template-columns: minmax(0, 1fr);
  }

  .sign-in__brand-panel {
    display: none;
  }

  .sign-in__card {
    right: 16px;
    left: 16px;
    width: auto;
    max-height: calc(100% - 32px);
    padding: 32px 24px 0;
  }

  .sign-in__marks {
    display: none;
  }

  .sign-in__brand-form {
    padding: 0 24px;
  }
}
</style>
