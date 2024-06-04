<template>
  <div class="input-fields-container mt-3">
    <div class="input-field">
      <MInputField
        v-model="localName"
        :title="$t('projectExecution.steps.step2.nameTitleField')"
        :placeholder="$t('projectExecution.steps.step2.namePlaceholder')"
        type="text"
      />
    </div>
    <div class="input-field">
      <MInputField
        v-model="localDescription"
        :title="$t('projectExecution.steps.step2.descriptionTitleField')"
        :placeholder="$t('projectExecution.steps.step2.descriptionPlaceholder')"
        type="text"
        prependInnerIcon="mdi-text"
      />
    </div>
  </div>
</template>

<script>
export default {
  props: ['name', 'description'],
  computed: {
    localName: {
      get() {
        return this.name
      },
      set(value) {
        this.$emit('update:name', value)
      },
    },
    localDescription: {
      get() {
        return this.description
      },
      set(value) {
        this.$emit('update:description', value)
      },
    },
  },
}
</script>

<style scoped>
.input-fields-container {
  display: flex;
  justify-content: space-between;
}

.input-field {
  width: 45%;
}
</style>
