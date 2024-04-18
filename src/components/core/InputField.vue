<template>
  <div>
    <span class="title-input">
      {{ title }}
    </span>
    <v-text-field
      variant="outlined"
      density="compact"
      hide-details
      :type="type"
      :placeholder="placeholder"
      :prefix="prefix"
      :suffix="suffix"
      :rules="rules"
      v-model="computedValue"
      style="font-size: 0.9rem !important"
    >
      <template v-slot:prepend v-if="prependIcon">
        <v-icon v-if="prependIcon">{{ prependIcon }}</v-icon>
      </template>
      <template v-slot:append v-if="appendIcon">
        <v-icon v-if="appendIcon">{{ appendIcon }}</v-icon>
      </template>
      <template v-slot:prepend-inner v-if="prependInnerIcon">
        <v-icon v-if="prependInnerIcon">{{ prependInnerIcon }}</v-icon>
      </template>
      <template v-slot:append-inner v-if="appendInnerIcon">
        <v-icon v-if="appendInnerIcon">{{ appendInnerIcon }}</v-icon>
      </template>
    </v-text-field>
  </div>
</template>

<script>
export default {
  name: 'InputField',
  props: {
    type: {
      type: String,
      default: 'text',
    },
    prependIcon: String,
    appendIcon: String,
    prependInnerIcon: String,
    appendInnerIcon: String,
    title: String,
    placeholder: String,
    prefix: String,
    suffix: String,
    rules: Array,
    modelValue: [String, Number, Boolean],
  },
  computed: {
    computedValue: {
      get() {
        return this.modelValue
      },
      set(value) {
        this.$emit('update:modelValue', value)
      },
    },
  },
}
</script>

<style scoped>
.title-input {
  color: var(--subtitle);
  font-weight: 500;
  font-size: 0.9rem;
}
</style>
