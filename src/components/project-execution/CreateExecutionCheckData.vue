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
        
        // Step 1: Create the instance
        const result = await this.generalStore.createInstance(this.newExecution)
        if (!result) {
          this.checksError = true
          this.showSnackbar(
            this.$t('projectExecution.snackbar.instanceCreationError'),
            'error'
          )
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
      } catch (error) {
        this.checksError = true
        this.showSnackbar(
          this.$t('projectExecution.snackbar.instanceDataChecksError'),
          'error'
        )
        console.error('Data check error:', error)
      }
    },
  },
}
</script>
