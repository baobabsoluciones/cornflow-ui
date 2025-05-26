import { defineStore } from 'pinia'
import session from '@/services/AuthService'
import config from '@/app/config'
import logo from '@/app/assets/logo/logo.png'
import fullLogo from '@/app/assets/logo/full_logo.png'

import { SchemaConfig } from '@/models/SchemaConfig'
import { Execution } from '@/models/Execution'
import { LoadedExecution } from '@/models/LoadedExecution'

import SchemaRepository from '@/repositories/SchemaRepository'
import UserRepository from '@/repositories/UserRepository'
import ExecutionRepository from '@/repositories/ExecutionRepository'
import InstanceRepository from '@/repositories/InstanceRepository'
import LicenceRepository from '@/repositories/LicenceRepository'

import { toISOStringLocal } from '@/utils/data_io'
import i18n from '@/plugins/i18n'

// Import utility functions
import * as tableUtils from '@/utils/tableUtils'
import * as filterUtils from '@/utils/filterUtils'

export const useGeneralStore = defineStore('general', {
  state: () => ({
    schemaRepository: new SchemaRepository(),
    executionRepository: new ExecutionRepository(),
    instanceRepository: new InstanceRepository(),
    userRepository: new UserRepository(),
    licenceRepository: new LicenceRepository(),
    notifications: [] as {
      message: string
      type: 'success' | 'warning' | 'info' | 'error'
    }[],
    licences: [],
    user: {},
    logo: logo,
    fullLogo: fullLogo,
    schema: '',
    schemaConfig: {} as SchemaConfig,
    appConfig: config.getCore(),
    appDashboardRoutes: config.getDashboardRoutes(),
    appDashboardPages: config.getDashboardPages(),
    appDashboardLayout: config.getDashboardLayout(),
    lastExecutions: [] as Execution[],
    loadedExecutions: [] as LoadedExecution[],
    selectedExecution: null,
    autoLoadInterval: null,
    uploadComponentKey: 0,
    tabBarKey: 0,
  }),
  actions: {
    async initializeData() {
      // Ensure the API client has the token loaded
      const apiClient = await import('@/api/Api')
      apiClient.default.initializeToken?.()
      
      await this.fetchUser()
      await this.setSchema()
      await this.fetchLicences()
    },

    async fetchUser() {
      try {
        const userId = await session.getUserId()
        this.user = await this.userRepository.getUserById(userId)
      } catch (error) {
        console.error('Error getting user', error)
      }
    },

    async fetchLicences() {
      try {
        this.licences = await this.licenceRepository.getLicences()
      } catch (error) {
        console.error('Error getting licences', error)
      }
    },

    async changeUserPassword(userId: string, password: string) {
      try {
        const response = await this.userRepository.changePassword(
          userId,
          password,
        )
        return response
      } catch (error) {
        console.error('Error changing password', error)
        return false
      }
    },

    async setSchema() {
      try {
        const schema = await this.schemaRepository.getSchema(this.getSchemaName)
        this.schemaConfig = schema
      } catch (error) {
        console.error('Error getting schema', error)
      }
    },

    async fetchExecutionsByDateRange(fromDate: Date, toDate: Date) {
      try {
        let executions = []
        if (!fromDate || !toDate) {
          executions = await this.executionRepository.getExecutions(
            this.getSchemaName,
            null,
            null,
          )
        } else {
          executions = await this.executionRepository.getExecutions(
            this.getSchemaName,
            toISOStringLocal(fromDate),
            toISOStringLocal(toDate, true),
          )
        }

        return executions
      } catch (error) {
        console.error('Error getting executions by date range', error)
      }
    },

    async fetchLoadedExecution(id: string) {
      try {
        const loadedExecution = await this.executionRepository.loadExecution(id)
        if (loadedExecution) {
          this.addLoadedExecution(loadedExecution)
          return true
        }
        return false
      } catch (error) {
        console.error('Error getting loaded execution', error)
      }
    },

    async createInstance(data) {
      try {
        const response = await this.instanceRepository.createInstance(data)
        return response
      } catch (error) {
        console.error('Error creating instance', error)
        return false
      }
    },

    async getInstanceById(id: string) {
      try {
        const instance = await this.instanceRepository.getInstance(id)
        return instance
      } catch (error) {
        console.error('Error getting instance', error)
      }
    },

    async getInstanceDataChecksById(id: string) {
      try {
        const dataChecks = await this.instanceRepository.launchInstanceDataChecks(id)
        const executionId = dataChecks.id

        let execution
        do {
          execution = await this.executionRepository.loadExecution(executionId)
          if (execution && execution.state !== 1) {
            await new Promise((resolve) => setTimeout(resolve, 3000))
          }
        } while (execution && execution.state !== 1)

        const instance = await this.instanceRepository.getInstance(id)
        return instance
      } catch (error) {
        console.error('Error getting instance data checks', error)
        return null // Explicitly return null to indicate an error
      }
    },

    async createExecution(execution: Execution, queryParams: string = '') {
      try {
        await this.executionRepository.createExecution(execution, queryParams)
        return true
      } catch (error) {
        console.error('Error creating execution:', error)
        return false
      }
    },

    async uploadSolutionData(executionId: string, solutionData: any) {
      try {
        await this.executionRepository.uploadSolutionData(executionId, solutionData)
        return true
      } catch (error) {
        console.error('Error uploading solution data:', error)
        return false
      }
    },

    async deleteExecution(id: string) {
      try {
        const result = await this.executionRepository.deleteExecution(id)
        if (result) {
          // Filter out the execution with the given id from lastExecutions
          this.lastExecutions = this.lastExecutions.filter(
            (execution) => execution.id !== id,
          )

          // Filter out the execution with the given executionId from loadedExecutions
          this.loadedExecutions = this.loadedExecutions.filter(
            (execution) => execution.executionId !== id,
          )
        }
        return result
      } catch (error) {
        console.error('Error deleting execution', error)
      }
    },

    addLoadedExecution(loadedExecution: LoadedExecution) {
      const index = this.loadedExecutions.findIndex(
        (execution) => execution.executionId === loadedExecution.executionId,
      )

      if (index !== -1) {
        // Replace the existing loadedExecution
        this.loadedExecutions.splice(index, 1, loadedExecution)
      } else {
        // Add the new loadedExecution
        this.loadedExecutions.push(loadedExecution)
      }

      // Start auto-loading executions
      this.autoLoadExecutions()
    },

    async autoLoadExecutions() {
      // Clear any existing interval
      if (this.autoLoadInterval) {
        clearInterval(this.autoLoadInterval)
      }

      // Start a new interval
      this.autoLoadInterval = setInterval(async () => {
        for (let execution of this.loadedExecutions) {
          if (execution.state === 0 || execution.state === -7) {
            try {
              const updatedExecution =
                await this.executionRepository.loadExecution(
                  execution.executionId,
                )
              if (updatedExecution) {
                this.addLoadedExecution(updatedExecution)

                // If the updated execution is the selected execution, update it too
                if (
                  this.selectedExecution &&
                  this.selectedExecution.executionId === execution.executionId
                ) {
                  this.selectedExecution = updatedExecution
                }
              }
            } catch (error) {
              console.error('Error auto-loading execution', error)
            }
          }
        }
      }, 4000) // Check every 4 seconds
    },

    removeLoadedExecution(index: number) {
      this.loadedExecutions.splice(index, 1)
    },

    resetLoadedExecutions() {
      this.loadedExecutions = []
    },

    setSelectedExecution(executionId: string | null) {
      if (executionId === null) {
        this.selectedExecution = null
      } else {
        this.selectedExecution = this.loadedExecutions.find(
          (execution) => execution.executionId === executionId,
        )
      }
    },

    addNotification(notification: {
      message: string
      type: 'success' | 'warning' | 'info' | 'error'
    }) {
      this.notifications.push(notification)
    },

    removeNotification(index: number) {
      this.notifications.splice(index, 1)
    },

    resetNotifications() {
      this.notifications = []
    },

    incrementUploadComponentKey() {
      this.uploadComponentKey++
    },

    incrementTabBarKey() {
      return this.tabBarKey++
    },

    // Table methods - delegated to tableUtils
    getTableDataNames(collection: string, data: object, lang = 'en'): any[] {
      return tableUtils.getTableDataNames(this.schemaConfig, collection, data, lang)
    },

    getHeadersFromData(data): any[] {
      return tableUtils.getHeadersFromData(data)
    },

    getTableHeadersData(collection, table, lang = 'en'): any[] {
      return tableUtils.getTableHeadersData(this.schemaConfig, collection, table, lang)
    },

    getConfigTableHeadersData(): any[] {
      return tableUtils.getConfigTableHeadersData()
    },

    // Filter methods - delegated to filterUtils
    getFilterNames(collection, table, type, lang = 'en'): any {
      return filterUtils.getFilterNames(this.schemaConfig, this.selectedExecution, collection, table, type, lang)
    },

    getConfigTableData(data: object, collection, table, lang = 'en'): any[] {
      return tableUtils.getConfigTableData(this.schemaConfig, data, collection, table, lang)
    },

    async getDataToDownload(
      id: string,
      onlySolution: boolean = false,
      onlyInstance: boolean = false,
    ) {
      let solution = false
      let instance = false
      if (onlySolution) {
        solution = true
      }

      if (onlyInstance) {
        instance = true
      }

      try {
        await this.executionRepository.getDataToDownload(id, solution, instance)
      } catch (error) {
        throw error
      }
    },
  },
  getters: {
    getNotifications(): any {
      return this.notifications
    },

    getLogo(): string {
      return this.logo
    },

    getUser(): any {
      return this.user
    },

    getLicences(): any {
      return this.licences
    },

    getSchemaName(): string {
      return this.appConfig.parameters.schema
    },

    getSchemaConfig(): SchemaConfig {
      return this.schemaConfig
    },

    getExecutionSolvers(): string[] {
      return this.schemaConfig.config.properties.solver.enum
    },

    getLoadedExecutionTabs(): object[] {
      return this.loadedExecutions.map((execution) => {
        let icon
        let isLoading = false
        switch (execution.state) {
          case 1:
            icon = 'mdi-checkbox-marked'
            break
          case 0:
          case -7:
            isLoading = true
            icon = 'mdi-loading'
            break
          default:
            icon = 'mdi-close-box'
        }

        return {
          value: execution.executionId,
          text: execution.name,
          icon: icon,
          loading: isLoading,
          selected: false,
        }
      })
    },
  },
})
