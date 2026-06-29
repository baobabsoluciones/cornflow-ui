<template>
  <div
    class="check-data-container"
    :class="{ 'has-tables': hasValidationTables }"
  >
    <v-alert v-if="checksHasBlockingErrors" type="error" class="mb-4">
      {{ $t('projectExecution.checks.blockingErrorsFound') }}
    </v-alert>

    <ExecutionDataView
      :execution="newExecution"
      :checksFinished="checksFinished"
      :checksError="checksError"
      :checksInProgress="checksInProgress"
      :readOnly="false"
      :checksSchema="checksSchema"
      canCheckData
      @check-data="createInstance"
    />
  </div>
</template>

<script>
import { inject, nextTick } from 'vue'
import { useGeneralStore } from '@/stores/general'
import ExecutionDataView from '@/components/project-execution/ExecutionDataView.vue'
import appConfig from '@/app/config.ts'

export default {
  components: { ExecutionDataView },
  props: {
    newExecution: {
      type: Object,
      required: true,
    },
  },
  emits: ['update:instance', 'checks-launching', 'blocking-errors'],
  data() {
    return {
      showSnackbar: null,
      generalStore: useGeneralStore(),
      checksFinished: false,
      checksError: false,
      checksInProgress: false,
      checksHasBlockingErrors: false,
    }
  },
  computed: {
    checksSchema() {
      return this.generalStore.schemaConfig?.instanceChecksSchema ?? null
    },
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
    // Yields the main thread so the browser can paint the loading state before
    // the first heavy synchronous step (stripping + JSON.stringify of the full
    // instance inside createInstance). `nextTick` only flushes Vue's DOM patch
    // (a microtask) and never waits for a paint, so on the first/cold run the
    // "data is loading" alert was patched into the DOM but blocked-out before
    // being painted.
    //
    // In a real browser we wait for an actual paint via a double rAF. In the
    // test runtime (Node/jsdom, where `setImmediate` exists) we mirror
    // @vue/test-utils' `flushPromises` scheduler instead, so this resolves on
    // the same macrotask boundary (FIFO) and never stalls tests that only
    // `await flushPromises()`.
    waitForPaint() {
      if (typeof setImmediate === 'function') {
        return new Promise((resolve) => setImmediate(resolve))
      }
      if (typeof requestAnimationFrame === 'function') {
        return new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        )
      }
      return Promise.resolve()
    },
    computeHasBlockingErrors(instance) {
      if (!appConfig.getCore().parameters.enableBlockAdvanceOnCheckErrors)
        return false
      const schema = this.checksSchema
      if (!schema?.properties) return false
      const dataChecks = instance?.dataChecks ?? {}
      return Object.entries(schema.properties).some(([key, prop]) => {
        // Only consider tables where is_warning is explicitly false (not merely absent)
        if (prop.is_warning !== false) return false
        const rows = dataChecks[key]
        return Array.isArray(rows) && rows.length > 0
      })
    },
    async createInstance() {
      this.checksInProgress = true
      this.$emit('checks-launching', true)
      try {
        this.checksFinished = false
        this.checksError = false

        // Let the child pick up loading props (nextTick) AND let the browser
        // paint the loading state (waitForPaint) before the first heavy
        // synchronous step in createInstance. Without the paint wait, on the
        // first/cold run the loading alert was patched into the DOM but never
        // painted before the main thread blocked, so it was never seen.
        await nextTick()
        await this.waitForPaint()

        // Generate name with timestamp and _check if name is null
        const executionData = { ...this.newExecution }
        if (!executionData.name) {
          const timestamp = new Date()
            .toISOString()
            .replaceAll(/[:.]/g, '-')
            .slice(0, -5)
          executionData.name = `${timestamp}_check`
        }

        const result = await this.generalStore.createInstance(executionData)
        if (!result) {
          this.checksError = true
          this.showSnackbar(
            this.$t('projectExecution.snackbar.instanceCreationError'),
            'error',
          )
          return
        }

        const instance = await this.generalStore.getInstanceDataChecksById(
          result.id,
        )
        if (instance) {
          this.checksFinished = true

          const hasBlocking = this.computeHasBlockingErrors(instance)
          this.checksHasBlockingErrors = hasBlocking
          this.$emit('blocking-errors', hasBlocking)

          if (hasBlocking) {
            this.showSnackbar(
              this.$t('projectExecution.snackbar.instanceDataChecksError'),
              'error',
            )
          } else {
            this.showSnackbar(
              this.$t('projectExecution.snackbar.instanceDataChecksSuccess'),
            )
          }

          await nextTick()

          this.$emit('update:instance', instance)
        } else {
          this.checksError = true
          this.showSnackbar(
            this.$t('projectExecution.snackbar.instanceDataChecksError'),
            'error',
          )
        }
      } catch (error) {
        this.checksError = true
        this.showSnackbar(
          this.$t('projectExecution.snackbar.instanceDataChecksError'),
          'error',
        )
        console.error('Data check error:', error)
      } finally {
        this.checksInProgress = false
        this.$emit('checks-launching', false)
      }
    },
  },
}
</script>

<style scoped>
.check-data-container {
  width: 100%;
  margin-top: 1rem;
}
</style>
