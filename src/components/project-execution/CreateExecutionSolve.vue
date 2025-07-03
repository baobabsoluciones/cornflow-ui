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

      <!-- Developer Mode Solution Upload -->
      <v-row v-if="isDeveloperMode" class="mt-4">
        <v-col>
          <v-card class="pa-4">
            <v-card-title class="text-h6">
              {{ $t('projectExecution.steps.step7.developerMode.title') }}
            </v-card-title>
            <v-card-text>
              <v-radio-group v-model="solveMode" class="mt-2">
                <v-radio :label="$t('projectExecution.steps.step7.developerMode.normalSolve')" value="normal"></v-radio>
                <v-radio :label="$t('projectExecution.steps.step7.developerMode.uploadSolution')" value="upload"></v-radio>
              </v-radio-group>

              <div v-if="solveMode === 'upload'" class="mt-4">
                <MDragNDropFile
                  :multiple="false"
                  downloadIcon="mdi-upload"
                  :description="$t('projectExecution.steps.step7.developerMode.dragAndDropDescription')"
                  :uploadedFiles="solutionFile ? [solutionFile] : []"
                  :formatsAllowed="['json', 'xlsx', 'csv']"
                  :errors="solutionErrors"
                  :downloadButtonTitle="$t('projectExecution.steps.step7.developerMode.uploadFile')"
                  :invalidFileText="$t('projectExecution.steps.step7.developerMode.invalidFileFormat')"
                  @file-selected="onSolutionFileSelected"
                />
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row class="justify-center">
        <v-btn 
          @click="createExecution()" 
          variant="outlined" 
          class="mt-5"
          :disabled="solveMode === 'upload' && !solutionFile"
        >
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
import { inject, computed, ref } from 'vue'
import { useGeneralStore } from '@/stores/general'
import { Solution } from '@/app/models/Solution'

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
      solveMode: 'normal',
      solutionFile: null,
      solutionErrors: null,
      solutionData: null
    }
  },
  computed: {
    configFields() {
      return this.generalStore.appConfig.parameters.configFields || []
    },
    isDeveloperMode() {
      return this.generalStore.appConfig.parameters.isDeveloperMode
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
  },
  methods: {
    async onSolutionFileSelected(file) {
      this.solutionFile = file
      this.solutionErrors = null

      try {
        const extension = file.name.split('.').pop()
        const solution = await this.parseSolutionFile(file, extension)
        
        // Validate solution schema
        const errors = await solution.checkSchema()
        if (errors && errors.length > 0) {
          this.solutionErrors = errors
            .map(error => `<li>${error.instancePath} - ${error.message}</li>`)
            .join('')
          this.solutionData = null
          if (this.showSnackbar) {
            this.showSnackbar(
              this.$t('projectExecution.steps.step7.developerMode.solutionSchemaError'),
              'error'
            )
          }
          return
        }

        this.solutionData = solution.data
      } catch (error) {
        console.error('Error processing solution file:', error)
        this.solutionErrors = `<p><strong>Error:</strong></p><li>${error.message}</li>`
        this.solutionData = null
        if (this.showSnackbar) {
          this.showSnackbar(error.message || error, 'error')
        }
      }
    },

    async parseSolutionFile(file, extension) {
      return new Promise((resolve, reject) => {
        const fileReader = new FileReader()
        
        fileReader.onload = async () => {
          try {
            const { Solution } = this.generalStore.appConfig
            const schemas = this.generalStore.getSchemaConfig

            if (extension === 'xlsx') {
              const solution = await Solution.fromExcel(
                fileReader.result,
                schemas.solutionSchema,
                this.generalStore.appConfig.parameters.schema
              )
              resolve(solution)
            } else if (extension === 'json') {
              const jsonData = JSON.parse(fileReader.result)
              const solution = new Solution(
                null,
                jsonData,
                schemas.solutionSchema,
                schemas.solutionChecksSchema,
                this.generalStore.appConfig.parameters.schema
              )
              resolve(solution)
            } else if (extension === 'csv') {
              const solution = await Solution.fromCsv(
                fileReader.result,
                file.name,
                schemas.solutionSchema,
                schemas.solutionChecksSchema,
                this.generalStore.appConfig.parameters.schema
              )
              resolve(solution)
            } else {
              throw new Error(this.$t('projectExecution.steps.step7.developerMode.unsupportedFileFormat'))
            }
          } catch (error) {
            reject(error)
          }
        }
        
        fileReader.onerror = () => {
          reject(new Error(this.$t('projectExecution.steps.step7.developerMode.fileReadError')))
        }
        
        if (extension === 'xlsx') {
          fileReader.readAsArrayBuffer(file)
        } else {
          fileReader.readAsText(file)
        }
      })
    },

    async createExecution() {
      try {
        this.executionIsLoading = true

        if (this.solveMode === 'upload' && !this.solutionData) {
          throw new Error(this.$t('projectExecution.steps.step7.developerMode.noSolutionData'))
        }

        // Create execution with run=0 if uploading solution
        const result = await this.generalStore.createExecution(
          this.newExecution,
          this.solveMode === 'upload' ? '?run=0' : ''
        )

        if (result) {
          if (this.solveMode === 'upload') {
            // Upload solution data
            const uploadResult = await this.generalStore.uploadSolutionData(
              result.id,
              this.solutionData
            )
            if (!uploadResult) {
              throw new Error(this.$t('projectExecution.steps.step7.developerMode.uploadError'))
            }
          }

          const loadedResult = await this.generalStore.fetchLoadedExecution(result.id)

          if (loadedResult) {
            this.executionIsLoading = false
            this.executionLaunched = true
            this.showSnackbar(
              this.$t('projectExecution.snackbar.successCreate')
            )
          } else {
            this.showSnackbar(
              this.$t('projectExecution.snackbar.errorCreate'),
              'error'
            )
          }
        } else {
          this.showSnackbar(
            this.$t('projectExecution.snackbar.errorCreate'),
            'error'
          )
          this.executionIsLoading = false
        }
      } catch (error) {
        this.showSnackbar(
          error.message || this.$t('projectExecution.snackbar.errorCreate'),
          'error'
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
