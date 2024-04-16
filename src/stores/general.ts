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
import { create } from 'domain'

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
          fromDate.toISOString(),
          toDate.toISOString(),
        )
        this.lastExecutions = executions
      } catch (error) {
        console.error('Error getting last executions', error)
      }
    },

    async fetchExecutionsByDateRange(fromDate: string, toDate: string) {
      try {
        const executions = await this.executionRepository.getExecutions(
          this.getSchemaName,
          fromDate.toISOString(),
          toDate.toISOString(),
        )
        return executions
      } catch (error) {
        console.error('Error getting executions by date range', error)
      }
    },

    async fetchLoadedExecution(id: string) {
      try {
        const loadedExecution = await this.executionRepository.loadExecution(id)
        this.addLoadedExecution(loadedExecution)
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

    addLoadedExecution(loadedExecution: LoadedExecution) {
      this.loadedExecutions.push(loadedExecution)
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
  },
})
