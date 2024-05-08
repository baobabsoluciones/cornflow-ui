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
import i18n from '@/plugins/i18n'

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
    appDashboardRoutes: config.getDashboardRoutes(),
    appDashboardPages: config.getDashboardPages(),
    appDashboardLayout: config.getDashboardLayout(),
    lastExecutions: [] as Execution[],
    loadedExecutions: [] as LoadedExecution[],
    selectedExecution: null,
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
        if (!fromDate || !toDate) return
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

    async createExecution(execution: Execution) {
      try {
        const newExecution =
          await this.executionRepository.createExecution(execution)
        return newExecution
      } catch (error) {
        console.error('Error creating execution', error)
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

    getTableDataKeys(collection: string, data: object): any[] {
      const schemaChecks = this.schemaConfig[collection]
      const schemaKeys = [...schemaChecks.required]
      const keys = Object.keys(data)

      return Array.from(new Set([...schemaKeys, ...keys]))
    },

    getTableDataNames(collection: string, data: object, lang = 'en'): any[] {
      return this.getTableDataKeys(collection, data).map((el) => {
        const title = this.getTableDataName(collection, el, lang)
        return { text: title ?? el, value: el }
      })
    },

    getTableDataName(collection: string, key: string, lang = 'en'): string {
      const title = this.schemaConfig[collection].properties[key].title
      if (typeof title === 'string') {
        return title
      } else if (typeof title === 'object') {
        return title[lang] ?? title.en ?? key
      }
      return key
    },

    getTableJsonSchema(collection: string, table): any {
      return this.schemaConfig[collection].properties[table]
    },

    getTableOption(collection: string, table, option): any {
      return this.getTableJsonSchema(collection, table)[option]
    },

    showTable(collection: string, table: string): boolean {
      const show = this.getTableOption(collection, table, 'show')
      return show !== undefined ? show : true
    },

    getTableHeader(collection, table): any[] {
      const items = this.getTableJsonSchema(collection, table).items
      const keys = Object.keys(items.properties)
      const required = items.required || []

      return Array.from(new Set([...required, ...keys]))
    },

    getTableJsonSchemaProperty(collection, table, property): any {
      return this.getTableJsonSchema(collection, table).items.properties[
        property
      ]
    },

    isTablePropertySortable(collection, table, item): boolean {
      const propSortable = this.getTableJsonSchemaProperty(
        collection,
        table,
        item,
      ).sortable
      if (propSortable === undefined) {
        const tableSortable = this.getTableJsonSchemaProperty(
          collection,
          table,
          item,
        ).sortable
        return tableSortable !== undefined ? tableSortable : true
      }
      return propSortable
    },

    getTablePropertyTitle(collection, table, item, lang = 'en'): string {
      const title = this.getTableJsonSchemaProperty(
        collection,
        table,
        item,
      ).title
      if (typeof title === 'string') {
        return title
      } else if (typeof title === 'object') {
        return title[lang] || title.en || item
      }
      return item
    },

    getTableHeaders(collection, table): any[] {
      const items = this.getTableJsonSchema(collection, table).items
      const keys = Object.keys(items.properties)
      let result = items.required?.slice()

      if (!result || result.length === 0) {
        result = keys
      } else {
        keys.forEach((el) => {
          if (!result.includes(el)) {
            result.push(el)
          }
        })
      }

      return result
    },

    getTableHeadersData(collection, table, lang = 'en'): any[] {
      const headers = this.getTableHeaders(collection, table)
      return headers.map((header) => ({
        title: this.getTablePropertyTitle(collection, table, header, lang),
        value: header,
        sortable: this.isTablePropertySortable(collection, table, header),
        filterable: this.getTableJsonSchemaProperty(collection, table, header)
          .filterable,
        type:
          this.getTableJsonSchemaProperty(collection, table, header).type ===
          'integer'
            ? 'number'
            : this.getTableJsonSchemaProperty(collection, table, header).type,
        required: this.getTableJsonSchema(
          collection,
          table,
        ).items.required?.includes(header),
      }))
    },

    getConfigTableHeadersData(): any[] {
      return [
        {
          title: i18n.global.t('inputOutputData.parameter'),
          value: 'displayName',
          sortable: true,
          disabled: true,
          config: true,
        },
        {
          title: i18n.global.t('inputOutputData.value'),
          value: 'value',
          sortable: true,
          config: true,
        },
        {
          title: i18n.global.t('inputOutputData.key'),
          value: 'key',
          sortable: true,
          disabled: true,
          config: true,
        },
      ]
    },

    getConfigTableData(data: object, collection, table, lang = 'en'): any[] {
      return Object.keys(data).map((key) => ({
        displayName: this.getConfigDisplayName(collection, table, key, lang),
        type: this.getConfigType(collection, table, key),
        value: data[key],
        key: key,
      }))
    },

    async getDataToDownload(id: string){
      const downloadedData = await this.executionRepository.getDataToDownload(id)
    },

    getConfigDisplayName(collection, table, key, lang = 'en'): string {
      const title = this.getTableJsonSchema(collection, table).properties[key]
        .title
      if (typeof title === 'string') {
        return title
      } else if (typeof title === 'object') {
        return title[lang] || title.en || key
      }
      return key
    },

    getConfigType(collection, table, key): string {
      return this.getTableJsonSchema(collection, table).properties[key].type ==
        'integer'
        ? 'number'
        : this.getTableJsonSchema(collection, table).properties[key].type
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
