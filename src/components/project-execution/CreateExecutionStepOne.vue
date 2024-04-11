<template>
  <div>
    <ExecutionOptionCard
      :value="optionSelected"
      :title="$t('projectExecution.steps.step1.firstOption.title')"
      :description="$t('projectExecution.steps.step1.firstOption.description')"
      option="createExecution"
      :selected="optionSelected"
      @checkbox-change="handleCheckboxChange"
    >
    </ExecutionOptionCard>
    <ExecutionOptionCard
      :value="optionSelected"
      :title="$t('projectExecution.steps.step1.secondOption.title')"
      :description="$t('projectExecution.steps.step1.secondOption.description')"
      icon="mdi-crosshairs"
      option="searchExecution"
      :selected="optionSelected"
      @checkbox-change="handleCheckboxChange"
    >
    </ExecutionOptionCard>
  </div>
</template>

<script>
import ExecutionOptionCard from '@/components/project-execution/ExecutionOptionCard.vue'

export default {
  components: {
    ExecutionOptionCard,
  },
  props: {
    optionSelected: {
      type: String,
      required: true,
    },
  },
  methods: {
    handleCheckboxChange({ value, option }) {
      this.$emit('update:optionSelected', value ? option : null)
    },
  },
}
</script>
