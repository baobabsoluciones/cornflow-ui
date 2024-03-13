/**
 * This store is used to store specific data needed for the custom application.
 * 
 * The `app` store is defined using the `defineStore` function from `pinia`.
 * 
 * The `state` function is used to define the initial state of the store. This is where you can define the data that you want to store.
 * 
 * The `actions` object is used to define the actions that can be performed on the data. Actions are functions that cause side effects and can involve asynchronous operations.
 * 
 * The `getters` object is used to define computed properties based on the store state. Getters are functions that compute derived state based on the store's state.
 */
import { defineStore } from "pinia";


export const useAppStore = defineStore("app", {
  state: () => ({

  }),
  actions: {

  },
  getters: {

  },
});