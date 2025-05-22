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
          <v-list-item
            v-for="field in configFields"
            :key="field.key"
            :prepend-icon="field.icon || defaultIcon"
          >
            <template v-if="field.type === 'boolean'">
              <v-list-item-title class="small-font d-flex align-center">
                <span class="mr-2">{{ $t(field.title) }}:</span>
                <v-icon color="success" v-if="newExecution.config[field.key]">mdi-check-circle</v-icon>
                <v-icon color="error" v-else>mdi-close-circle</v-icon>
              </v-list-item-title>
            </template>
            <template v-else>
              <v-list-item-title class="small-font">
                {{ $t(field.title) }}: {{ newExecution.config[field.key] }}<span v-if="field.suffix">{{ $t(field.suffix) }}</span>
              </v-list-item-title>
            </template>
          </v-list-item>
          <v-list-item prepend-icon="mdi-wrench-outline" v-if="newExecution.config.solver">
            <v-list-item-title class="small-font">
              {{ newExecution.config.solver + ` solver` }}
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
import { inject, computed } from 'vue'
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
      defaultIcon: 'mdi-tune',
    }
  },
  computed: {
    configFields() {
      return this.generalStore.appConfig.parameters.configFields || []
    },
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
  },
  methods: {
    async createExecution() {
      try {
        this.executionIsLoading = true
        const result = await this.generalStore.createExecution(this.newExecution)
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
