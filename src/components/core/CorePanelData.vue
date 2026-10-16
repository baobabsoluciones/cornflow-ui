<template>
  <v-card class="rounded-lg pa-10" style="background-color: white !important">
    <v-row style="margin-top: -30px">
      <v-col v-for="option in regularOptions" :key="option.value" cols="auto">
        <v-checkbox
          v-model="selectedDateRange"
          :label="option.label"
          :value="option.value"
          class="custom-checkbox"
          :color="option.color"
          @change="$emit('date-range-changed', selectedDateRange)"
        />
      </v-col>
      <slot name="extra-filters"></slot>
      <v-col v-if="customOption" cols="auto">
        <v-checkbox
          v-model="selectedDateRange"
          :label="customOption.label"
          :value="customOption.value"
          class="custom-checkbox"
          :color="customOption.color"
          @change="$emit('date-range-changed', selectedDateRange)"
        />
      </v-col>
      <v-col v-if="selectedDateRange === 'custom'">
        <div class="ml-1" style="height: 50px !important">
          <slot name="custom-checkbox"></slot>
        </div>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <v-expansion-panels variant="accordion" multiple v-model="openedPanels">
          <v-expansion-panel v-for="(item, index) in data" :key="index">
            <v-expansion-panel-title>{{
              formatDateForHeaders(item.date, language)
            }}</v-expansion-panel-title>
            <v-expansion-panel-text>
              <slot
                name="table"
                :item-data="item.data"
                :show-headers="index === 0"
              ></slot>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
        <template v-if="data.length === 0">
          <div
            class="d-flex align-center justify-center"
            style="height: 100%; color: var(--subtitle)"
          >
            <slot name="no-data">{{ noDataMessage }}</slot>
          </div>
        </template>
      </v-col>
    </v-row>
  </v-card>
</template>

<script>
import { formatDateForHeaders } from '@cornflow-ui/core/utils/data_io'

export default {
  name: 'CorePanelData',
  props: {
    data: {
      type: Array,
      required: true,
    },
    showFirstHeaders: {
      type: Boolean,
      default: false,
    },
    checkboxOptions: {
      type: Array,
      required: true,
    },
    noDataMessage: {
      type: String,
      default: 'No data for the selected range',
    },
    allPanelsOpen: {
      type: Boolean,
      default: true,
    },
    language: {
      type: String,
      default: 'en',
    },
  },
  emits: ['date-range-changed'],
  data: () => ({
    selectedDateRange: null,
    openedPanels: [],
  }),
  computed: {
    regularOptions() {
      return this.checkboxOptions.filter((o) => !o.isCustom)
    },
    customOption() {
      return this.checkboxOptions.find((o) => o.isCustom) ?? null
    },
  },
  methods: {
    formatDateForHeaders,
  },
  watch: {
    data(newData, oldData) {
      if (newData.length !== oldData.length && this.allPanelsOpen) {
        this.openedPanels = newData.map((_, index) => index)
      }
    },
  },
}
</script>

<style scoped>
.v-expansion-panel-title {
  background-color: #f2f4f8 !important;
  font-weight: 500 !important;
}

.custom-checkbox {
  margin-bottom: -35px;
}

.custom-checkbox .v-label {
  font-size: 0.9rem;
  color: black !important;
  font-weight: 500 !important;
}
</style>
