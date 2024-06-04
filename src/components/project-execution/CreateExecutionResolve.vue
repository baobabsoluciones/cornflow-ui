<template>
  <div
    class="mt-4 d-flex justify-center"
    v-if="!executionLaunched && !executionIsLoading"
  >
    <v-col>
      <v-row class="justify-start">
        <v-list density="compact" min-width="250" rounded="lg" slim>
          <v-list-item prepend-icon="mdi-calendar-month-outline">
            <v-list-item-title class="small-font">
              {{ newExecution.name }}
            </v-list-item-title>
          </v-list-item>
          <v-list-item prepend-icon="mdi-text" v-if="newExecution.description">
            <v-list-item-title class="small-font">
              {{ newExecution.description }}
            </v-list-item-title>
          </v-list-item>
          <v-list-item prepend-icon="mdi-timelapse">
            <v-list-item-title class="small-font">
              {{ newExecution.timeLimit + `s max.` }}
            </v-list-item-title>
          </v-list-item>
          <v-list-item prepend-icon="mdi-wrench-outline">
            <v-list-item-title class="small-font">
              {{ newExecution.selectedSolver + ` solver` }}
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-row>
      <v-row class="justify-center">
        <v-btn @click="createExecution()" variant="outlined" class="mt-5">
          {{ $t('projectExecution.steps.step7.resolve') }}
        </v-btn>
      </v-row>
    </v-col>
  </div>
  <div v-else-if="executionIsLoading" class="d-flex justify-center mt-5">
    <v-progress-circular indeterminate></v-progress-circular>
  </div>
  <div v-else class="d-flex flex-column align-center justify-center">
    <v-icon style="font-size: 3.5rem" color="green" class="mt-5"
      >mdi-check-circle-outline</v-icon
    >
    <p class="text-center mt-3" style="font-size: 0.9rem">
      {{ $t('projectExecution.steps.step7.successMessage') }}
    </p>
    <v-btn
      @click="$emit('resetAndLoadNewExecution')"
      variant="outlined"
      class="mt-10"
    >
      {{ $t('projectExecution.steps.step7.loadNewExecution') }}
    </v-btn>
  </div>
</template>

<script>
import { inject } from 'vue'
import { useGeneralStore } from '@/stores/general'

export default {
  components: {},
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
          this.executionIsLoading = false
        }
      } catch (error) {
        this.showSnackbar(
          this.$t('projectExecution.snackbar.errorCreate'),
          'error',
        )
        this.executionIsLoading = false
      }
    },
  },
}
</script>
<style>
.small-font {
  font-size: 0.9rem;
}
</style>
