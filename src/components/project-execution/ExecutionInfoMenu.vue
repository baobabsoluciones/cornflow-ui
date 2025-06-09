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
        <template v-for="field in configFields" :key="field.key">
          <v-list-item v-if="selectedExecution.config[field.key] !== undefined" :prepend-icon="field.icon">
            <v-list-item-title class="small-font">
              {{ $t(field.title) }}: {{ formatConfigValue(selectedExecution.config[field.key], field.type) }}{{ field.suffix ? $t(field.suffix) : '' }}
            </v-list-item-title>
          </v-list-item>
        </template>
        <v-list-item prepend-icon="mdi-wrench-outline">
          <v-list-item-title class="small-font">
            {{ $t('projectExecution.steps.step5.title') }}: {{ selectedExecution.config.solver }}
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </v-btn>
</template>
<script>
import { formatDate } from '@/utils/data_io'
import { useGeneralStore } from '@/stores/general'

export default {
  props: {
    selectedExecution: {
      type: Object,
      required: true,
    },
  },
  computed: {
    configFields() {
      const generalStore = useGeneralStore()
      return generalStore.appConfig.parameters.configFields
    }
  },
  methods: {
    formatDate,
    formatConfigValue(value, type) {
      if (type === 'boolean') {
        return value ? this.$t('inputOutputData.true') : this.$t('inputOutputData.false')
      }
      return value
    }
  },
}
</script>

<style scoped>
.small-font {
  font-size: 0.85rem !important;
}
</style>
