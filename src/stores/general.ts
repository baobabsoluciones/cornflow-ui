import { defineStore } from "pinia";
import config from "@/app/config";
import logo from '@/app/assets/logo/logo.png'
import fullLogo from '@/app/assets/logo/full_logo.png'

import { SchemaConfig } from "@/models/SchemaConfig";
import { Execution } from "@/models/Execution";

import SchemaRepository from '@/repositories/SchemaRepository';
import ExecutionRepository from "@/repositories/ExecutionRepository";

export const useGeneralStore = defineStore("general", {
  state: () => ({
    schemaRepository: new SchemaRepository(),
    executionRepository: new ExecutionRepository(),
    notifications: [] as { message: string; type: 'success' | 'warning' | 'info' | 'error' }[],
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
  }),
  actions: {
    async initializeData() {

      await this.setSchema();
      await this.fetchLastExecutions();
    },

    async setSchema() {
      try {
        const schema = await this.schemaRepository.getSchema(this.getSchemaName);
        this.schemaConfig = schema;
      } catch (error) {
        console.error('Error getting schema', error);
      }
    },

    async fetchLastExecutions() {
      try {
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setDate(toDate.getDate() - 30);

        const executions = await this.executionRepository.getExecutions(this.getSchemaName, fromDate.toISOString(), toDate.toISOString());
        this.lastExecutions = executions;
      } catch (error) {
        console.error('Error getting last executions', error);
      }
    },

    addNotification(notification: { message: string; type: 'success' | 'warning' | 'info' | 'error' }) {
      this.notifications.push(notification);
    },

    removeNotification(index: number) {
      this.notifications.splice(index, 1);
     },

    resetNotifications() {
      this.notifications = [];
    },

  },
  getters: {
    getNotifications(): any {
      return this.notifications;
    },

    getSchemaName(): string {
      return this.appConfig.parameters.schema;
    }
  },
});