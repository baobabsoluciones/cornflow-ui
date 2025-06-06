<template>
  <v-card class="info-card" elevation="0">
    <v-card-title class="info-card-title">
      <slot name="title">{{ title }}</slot>
    </v-card-title>
    <v-card-text class="info-card-content">
      <slot />
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<style scoped>
.info-card {
  border-radius: 16px;
  background: var(--info-card-background);
  box-shadow: 0 1px 4px 0 rgba(16, 30, 54, 0.04);
  border: 1px solid var(--info-card-border);
}
.info-card-title {
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.2px;
  padding: 20px 24px 12px 24px;
  color: var(--info-card-title);
}
.info-card-content {
  padding: 16px 24px 24px 24px;
  color: var(--info-card-content);
}
</style> 