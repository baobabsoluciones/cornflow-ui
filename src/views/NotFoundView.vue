<template>
  <div class="not-found-container">
    <div class="not-found-content">
      <v-icon class="not-found-icon" color="primary">mdi-alert-circle-outline</v-icon>
      <h1 class="not-found-code">{{ isForbidden ? '403' : '404' }}</h1>
      <h2 class="not-found-title">
        {{ isForbidden ? t('notFound.forbiddenTitle') : t('notFound.title') }}
      </h2>
      <p class="not-found-subtitle">
        {{ isForbidden ? t('notFound.forbiddenMessage') : t('notFound.message') }}
      </p>
      <v-btn color="primary" variant="flat" class="mt-6" @click="goHome">
        {{ t('notFound.goHome') }}
      </v-btn>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useI18n } from 'vue-i18n'

export default defineComponent({
  name: 'NotFoundView',
  setup() {
    const { t } = useI18n()
    return { t }
  },
  computed: {
    isForbidden() {
      return this.$route.query.reason === 'forbidden'
    },
  },
  methods: {
    goHome() {
      this.$router.push('/')
    },
  },
})
</script>

<style scoped>
.not-found-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 48px 24px;
}

.not-found-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 480px;
}

.not-found-icon {
  font-size: 72px !important;
  opacity: 0.3;
  margin-bottom: 16px;
}

.not-found-code {
  font-size: 6rem;
  font-weight: 700;
  line-height: 1;
  color: rgb(var(--v-theme-primary));
  opacity: 0.15;
  margin: 0;
}

.not-found-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--title);
  margin: 16px 0 8px;
}

.not-found-subtitle {
  color: var(--subtitle);
  font-size: 0.95rem;
  margin: 0;
}
</style>
