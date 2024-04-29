<template>
  <div
    class="mt-4 d-flex justify-center"
    v-if="!executionLaunched && !executionIsLoading"
  >
    <InputDataTable
      :execution="newExecution"
      canEdit
      canResolve
      @save-changes="updateInstance"
      @resolve="createExecution"
    ></InputDataTable>
  </div>
  <div v-else-if="executionIsLoading" class="d-flex justify-center mt-5">
    <v-progress-circular indeterminate></v-progress-circular>
  </div>
  <div v-else class="d-flex flex-column align-center justify-center">
    <v-icon style="font-size: 3.5rem" color="green" class="mt-5"
      >mdi-check-circle-outline</v-icon
    >
    <p class="text-center mt-3" style="font-size: 0.9rem">
      {{ $t('projectExecution.steps.step6.successMessage') }}
    </p>
    <v-btn
      @click="$emit('resetAndLoadNewExecution')"
      variant="outlined"
      class="mt-10"
    >
      {{ $t('projectExecution.steps.step6.loadNewExecution') }}
    </v-btn>
  </div>
</template>

<script>
import { inject } from 'vue'
import { useGeneralStore } from '@/stores/general'
import InputDataTable from '@/components/core/input-data/InputOutputDataTable.vue'

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
      executionIsLoading: false,
      executionLaunched: false,
      showSnackbar: null,
      generalStore: useGeneralStore(),
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
  },
  methods: {
    updateInstance(newInstance) {
      this.$emit('update:instance', newInstance)
    },
    async createExecution() {
      try {
        this.executionIsLoading = true
        const result = await this.generalStore.createExecution(
          this.newExecution,
        )
        if (result) {
          const loadedResult = await this.generalStore.fetchLoadedExecution(
            result.id,
          )

          if (loadedResult) {
            this.executionIsLoading = false
            this.executionLaunched = true
            this.showSnackbar(
              this.$t('projectExecution.snackbar.successCreate'),
            )
          } else {
            this.showSnackbar(
              this.$t('projectExecution.snackbar.errorCreate'),
              'error',
            )
          }
        } else {
          this.showSnackbar(
            this.$t('projectExecution.snackbar.errorCreate'),
            'error',
          )
        }
      } catch (error) {
        this.showSnackbar(
          this.$t('projectExecution.snackbar.errorCreate'),
          'error',
        )
      }
    },
  },
}
</script>
