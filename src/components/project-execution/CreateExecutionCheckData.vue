<template>
  <div
    class="check-data-container"
    :class="{ 'has-tables': hasValidationTables }"
  >
    <ExecutionDataView
      :execution="newExecution"
      :checksFinished="checksFinished"
      :checksError="checksError"
      :readOnly="false"
      canCheckData
      @check-data="createInstance"
    />
  </div>
</template>

<script>
import { inject, nextTick } from 'vue'
import { useGeneralStore } from '@/stores/general'
import ExecutionDataView from '@/components/project-execution/ExecutionDataView.vue'

export default {
  components: { ExecutionDataView },
  props: {
    newExecution: {
      type: Object,
      required: true,
    },
  },
  emits: ['update:instance', 'checks-launching'],
  data() {
    return {
      showSnackbar: null,
      generalStore: useGeneralStore(),
      checksFinished: false,
      checksError: false,
    }
  },
  computed: {
    hasValidationTables() {
      // Check if there are validation tables in the execution instance
      const instanceData = this.newExecution?.instance?.dataChecks || {}
      return Object.keys(instanceData).length > 0
    },
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
  },
  methods: {
    updateInstance(newInstance) {
      this.$emit('update:instance', newInstance)
    },
    async createInstance() {
      try {
        // Reset status flags
        this.checksFinished = false
        this.checksError = false

        // Notify parent that checks are launching
        this.$emit('checks-launching', true)

        // Generate name with timestamp and _check if name is null
        const executionData = { ...this.newExecution }
        if (!executionData.name) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
          executionData.name = `${timestamp}_check`
        }

        // Step 1: Create the instance
        const result = await this.generalStore.createInstance(executionData)
        if (!result) {
          this.checksError = true
          this.showSnackbar(
            this.$t('projectExecution.snackbar.instanceCreationError'),
            'error',
          )
          this.$emit('checks-launching', false) // Notify parent that checks are done
          return
        }

        // Step 2: Launch data checks
        const instance = await this.generalStore.getInstanceDataChecksById(
          result.id,
        )
        if (instance) {
          this.checksFinished = true
          this.showSnackbar(
            this.$t('projectExecution.snackbar.instanceDataChecksSuccess'),
          )

          // Wait for the prop update to propagate to child components
          await nextTick()

          this.$emit('update:instance', instance)
        } else {
          this.checksError = true
          this.showSnackbar(
            this.$t('projectExecution.snackbar.instanceDataChecksError'),
            'error',
          )
        }

        // Notify parent that checks are done
        this.$emit('checks-launching', false)
      } catch (error) {
        this.checksError = true
        this.showSnackbar(
          this.$t('projectExecution.snackbar.instanceDataChecksError'),
          'error',
        )
        console.error('Data check error:', error)

        // Notify parent that checks are done
        this.$emit('checks-launching', false)
      }
    },
  },
}
</script>

<style scoped>
.check-data-container {
  width: 100%;
  height: auto;
  min-height: 200px;
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  transition: height 0.3s ease-in-out;
}

.check-data-container.has-tables {
  height: calc(100vh - 400px);
  min-height: 500px;
  max-height: 700px;
}
</style>
