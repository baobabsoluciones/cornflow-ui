<template>
  <div class="mt-4 d-flex justify-center">
    <InputDataTable
      :execution="newExecution"
      :checksFinished="checksFinished"
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
        this.checksFinished = false
        const result = await this.generalStore.createInstance(this.newExecution)

        if (result) {
          const instance = await this.generalStore.getInstanceDataChecksById(
            result.id,
          )

          if (instance) {
            this.showSnackbar(
              this.$t('projectExecution.snackbar.instanceDataChecksSuccess'),
            )
            this.checksFinished = true
            this.$emit('update:instance', instance)
          } else {
            this.showSnackbar(
              this.$t('projectExecution.snackbar.instanceDataChecksError'),
              'error',
            )
          }
        } else {
          this.showSnackbar(
            this.$t('projectExecution.snackbar.instanceDataChecksError'),
            'error',
          )
        }
      } catch (error) {
        this.showSnackbar(
          this.$t('projectExecution.snackbar.instanceDataChecksError'),
          'error',
        )
      }
    },
  },
}
</script>
