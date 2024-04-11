<template>
  <div class="icon-title">
    <div class="icon-title-row">
      <div class="icon">
        <v-icon>{{ icon }}</v-icon>
      </div>
      <h4 class="title">{{ title }}</h4>
    </div>
    <div class="description">
      <p v-if="description">{{ description }}</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'IconTitle',
  props: {
    icon: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
  },
}
</script>

<style scoped>
.icon-title {
  display: flex;
  flex-direction: column;
}

.icon-title-row {
  display: flex;
  align-items: center;
}

.icon {
  margin-right: 10px;
}

.title {
  margin: 0;
  font-size: 1.2rem !important;
  color: var(--title);
}

.description {
  margin: 0;
  font-size: 0.9rem !important;
  color: var(--subtitle);
}
</style>
