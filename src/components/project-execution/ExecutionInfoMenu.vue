<template>
  <v-btn
    size=""
    flat
    style="background-color: transparent; margin-top: -5px !important"
    v-if="selectedExecution"
  >
    <v-icon icon="mdi-information-slab-circle-outline"></v-icon>
    <v-menu activator="parent" location="end" transition="fade-transition">
      <v-list density="compact" min-width="250" rounded="lg" slim>
        <v-list-item prepend-icon="mdi-calendar-month-outline">
          <v-list-item-title class="small-font">
            {{ formatDate(selectedExecution.createdAt) }}
          </v-list-item-title>
        </v-list-item>
        <v-list-item
          prepend-icon="mdi-text"
          v-if="selectedExecution.description !== ''"
        >
          <v-list-item-title class="small-font">
            {{ selectedExecution.description }}
          </v-list-item-title>
        </v-list-item>
        <v-list-item prepend-icon="mdi-timelapse">
          <v-list-item-title class="small-font">
            {{ selectedExecution.config.timeLimit + `s max.` }}
          </v-list-item-title>
        </v-list-item>
        <v-list-item prepend-icon="mdi-wrench-outline">
          <v-list-item-title class="small-font">
            {{ selectedExecution.config.solver + ` solver` }}
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </v-btn>
</template>
<script>
import { formatDate } from '@/utils/data_io'

export default {
  props: {
    selectedExecution: {
      type: Object,
      required: true,
    },
  },
  computed: {},
  methods: {
    formatDate,
  },
}
</script>

<style scoped>
.small-font {
  font-size: 0.85rem !important;
}
</style>
