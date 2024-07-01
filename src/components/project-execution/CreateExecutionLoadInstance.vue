<template>
  <MDragNDropFile
    downloadIcon="mdi-upload"
    :description="
      $t('projectExecution.steps.step3.loadInstance.dragAndDropDescription')
    "
    :uploadedFile="selectedFile"
    :formatsAllowed="['json', 'xlsx']"
    :errors="instanceErrors"
    :downloadButtonTitle="
      $t('projectExecution.steps.step3.loadInstance.uploadFile')
    "
    :invalidFileText="
      $t('projectExecution.steps.step3.loadInstance.invalidFileFormat')
    "
    @file-selected="onFileSelected"
  />
</template>

<script>
import { Instance } from '@/app/models/Instance'
import { useGeneralStore } from '@/stores/general'
import { inject } from 'vue'

export default {
  components: {},
  props: {
    instance: {
      type: Instance,
      default: null,
    },
    fileSelected: {
      type: File,
      default: null,
    },
    existingInstanceErrors: {
      type: String,
      default: null,
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
  },
  data() {
    return {
      selectedFile: null,
      selectedInstance: null,
      instanceErrors: this.existingInstanceErrors,
      store: useGeneralStore(),
      showSnackbar: null,
    }
  },
  watch: {
    fileSelected: {
      handler(newFile) {
        this.selectedFile = newFile
      },
      immediate: true,
    },
    existingInstanceErrors: {
      handler(newErrors) {
        this.instanceErrors = newErrors
      },
      immediate: true
    }
  },
  methods: {
    onFileSelected(file) {
      this.selectedFile = file

      const extension = file.name.split('.').pop()

      return new Promise((resolve, reject) => {
        var fileReader = new FileReader()
        fileReader.onload = () => {
          return resolve(this.uploadInstance(fileReader.result, extension))
        }
        fileReader.onerror = reject
        if (extension === 'xlsx') {
          return fileReader.readAsArrayBuffer(file)
        } else {
          return fileReader.readAsText(file)
        }
      })
    },
    /**
     * Uploads an instance file and validates it against the schema.
     * @param {string} fileContent - The content of the file to upload.
     * @param {string} ext - The extension of the file to upload.
     * @throws Will throw an error if the schema is not found or if the instance does not comply with the schema.
     */
    async uploadInstance(fileContent, ext) {
      try {
        const { Instance } = this.store.appConfig
        const schemas = this.store.getSchemaConfig

        // Check if the schema exists
        if (schemas.instanceSchema == null) {
          throw new Error(
            this.$t('projectExecution.steps.step2.loadInstance.noSchemaError'),
          )
        }

        let instance

        if (ext === 'xlsx') {
          instance = await Instance.fromExcel(
            fileContent,
            schemas.instanceSchema,
            schemas.name,
          )
        } else if (ext === 'json') {
          const jsonData = JSON.parse(fileContent)
          instance = new Instance(
            null,
            jsonData,
            schemas.instanceSchema,
            schemas.instanceChecksSchema,
            schemas.name,
          )
        }

        // Validate the instance against the schema
        const errors = instance.checkSchema()

        if (errors && errors.length > 0) {
          this.instanceErrors = errors
            .map((error) => `<li>${error.instancePath} - ${error.message}</li>`)
            .join('')
            this.$emit('update:exisistingInstanceErrors', this.instanceErrors)
          throw new Error(
            this.$t(
              'projectExecution.steps.step3.loadInstance.instanceSchemaError',
            ),
          )
        }

        // If the instance is valid, set it as the selected instance and show a success message
        this.selectedInstance = instance
        this.$emit('instance-selected', this.selectedInstance)
        this.instanceErrors = null
        this.$emit('update:existingInstanceErrors', this.instanceErrors)
        this.showSnackbar(
          this.$t('projectExecution.steps.step3.loadInstance.instanceLoaded'),
        )

        return Promise.resolve({})
      } catch (error) {
        this.instanceErrors =
          this.instanceErrors.length > 0
            ? this.instanceErrors
            : this.$t(
                'projectExecution.steps.step3.loadInstance.unexpectedError',
              )
        this.$emit('update:existingInstanceErrors', this.instanceErrors)
        this.showSnackbar(error, 'error')
        throw new Error(error.message)
      }
    },
  },
}
</script>

<style></style>
