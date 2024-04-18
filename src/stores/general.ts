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

import { toISOStringLocal } from '@/utils/data_io'

export const useGeneralStore = defineStore('general', {
  state: () => ({
    schemaRepository: new SchemaRepository(),
    executionRepository: new ExecutionRepository(),
    userRepository: new UserRepository(),
    notifications: [] as {
      message: string
      type: 'success' | 'warning' | 'info' | 'error'
    }[],
    user: {},
    logo: logo,
    fullLogo: fullLogo,
    schema: '',
    schemaConfig: {} as SchemaConfig,
    appConfig: config.getCore(),
    appRoutes: config.getRoutes(),
    appPages: config.getPages(),
    appDashboard: config.getDashboard(),
    lastExecutions: [] as Execution[],
    loadedExecutions: [] as LoadedExecution[],
    autoLoadInterval: null,
  }),
  actions: {
    async initializeData() {
      await this.fetchUser()
      await this.setSchema()
      await this.fetchLastExecutions()
    },

    async fetchUser() {
      try {
        const userId = await session.getUserId()
        this.user = await this.userRepository.getUserById(userId)
      } catch (error) {
        console.error('Error getting user', error)
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

    async fetchLastExecutions() {
      try {
        const toDate = new Date()
        const fromDate = new Date()
        fromDate.setDate(toDate.getDate() - 30)

        const executions = await this.executionRepository.getExecutions(
          this.getSchemaName,
          toISOStringLocal(fromDate),
          toISOStringLocal(toDate, true),
        )
        this.lastExecutions = executions
      } catch (error) {
        console.error('Error getting last executions', error)
      }
    },

    async fetchExecutionsByDateRange(fromDate: Date, toDate: Date) {
      try {
        const executions = await this.executionRepository.getExecutions(
          this.getSchemaName,
          toISOStringLocal(fromDate),
          toISOStringLocal(toDate, true),
        )
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

    async createExecution(execution: Execution, createSolution = true) {
      try {
        const newExecution = await this.executionRepository.createExecution(
          execution,
          createSolution,
        )
        return newExecution
      } catch (error) {
        console.error('Error creating execution', error)
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
