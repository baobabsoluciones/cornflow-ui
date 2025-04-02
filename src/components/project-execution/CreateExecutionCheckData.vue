<template>
  <div class="mt-4 d-flex justify-center">
    <InputDataTable
      :execution="newExecution"
      :checksFinished="checksFinished"
      :checksError="checksError"
      canEdit
      canCheckData
      @save-changes="updateInstance"
      @check-data="createInstance"
    ></InputDataTable>
  </div>
</template>

<script>
import { inject } from 'vue'
import { useGeneralStore } from '@/stores/general'
import InputDataTable from '@/components/input-data/InputOutputDataTable.vue'

export default {
  components: { InputDataTable },
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
        
        // Step 1: Create the instance
        const result = await this.generalStore.createInstance(this.newExecution)
        if (!result) {
          this.checksError = true
          this.showSnackbar(
            this.$t('projectExecution.snackbar.instanceCreationError'),
            'error'
          )
          this.$emit('checks-launching', false) // Notify parent that checks are done
          return
        }

        // Step 2: Launch data checks
        const instance = await this.generalStore.getInstanceDataChecksById(result.id)
        if (instance) {
          this.checksFinished = true
          this.showSnackbar(
            this.$t('projectExecution.snackbar.instanceDataChecksSuccess')
          )
          this.$emit('update:instance', instance)
        } else {
          this.checksError = true
          this.showSnackbar(
            this.$t('projectExecution.snackbar.instanceDataChecksError'),
            'error'
          )
        }
        
        // Notify parent that checks are done
        this.$emit('checks-launching', false)
      } catch (error) {
        this.checksError = true
        this.showSnackbar(
          this.$t('projectExecution.snackbar.instanceDataChecksError'),
          'error'
        )
        console.error('Data check error:', error)
        
        // Notify parent that checks are done
        this.$emit('checks-launching', false)
      }
    },
  },
}
</script>
