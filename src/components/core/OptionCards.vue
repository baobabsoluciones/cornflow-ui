<template>
  <div class="option-cards" role="group" :aria-label="label">
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      class="option-card"
      :class="{ 'is-selected': isSelected(option.value) }"
      :aria-pressed="isSelected(option.value)"
      :data-testid="`option-card-${String(option.value)}`"
      @click="emit('update:modelValue', option.value)"
    >
      <span class="option-card__title">
        <v-icon v-if="option.icon" size="18" class="option-card__icon">{{
          option.icon
        }}</v-icon>
        {{ option.title }}
      </span>
      <span v-if="option.description" class="option-card__description">{{
        option.description
      }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'CoreOptionCards' })

export interface OptionCard {
  value: unknown
  title: string
  description?: string
  icon?: string
}

const props = defineProps<{
  modelValue: unknown
  options: OptionCard[]
  /** Accessible name of the group. */
  label?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const isSelected = (value: unknown): boolean =>
  value === props.modelValue ||
  (value != null &&
    props.modelValue != null &&
    String(value) === String(props.modelValue))
</script>

<style scoped>
.option-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.option-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 200px;
  padding: 12px 18px;
  border: 1px solid #dfe3ea;
  border-radius: 10px;
  background-color: #fff;
  text-align: left;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.option-card:hover {
  border-color: color-mix(in srgb, var(--primary) 45%, #fff);
}

.option-card.is-selected {
  border: 2px solid var(--primary);
  padding: 11px 17px;
  background-color: color-mix(in srgb, var(--primary) 7%, #fff);
}

.option-card:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.option-card__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--title);
}

.option-card__icon {
  color: var(--primary);
}

.option-card__description {
  font-size: 0.875rem;
  color: var(--subtitle);
}
</style>
