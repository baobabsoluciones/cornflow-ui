<template>
  <v-card class="rounded-lg pa-10" style="background-color: white !important">
    <v-row>
      <v-col class="v-col-8 v-col-s-12">
        <v-expansion-panels variant="accordion" multiple v-model="openedPanels">
          <v-expansion-panel v-for="(item, index) in data" :key="index">
            <v-expansion-panel-title>{{
              formatDateForHeaders(item.date)
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
      <v-col class="v-col-4 v-col-s-6">
        <v-card
          elevation="0"
          class="rounded-lg pa-3"
          style="background-color: #f2f4f8; height: 100% !important"
        >
          <v-checkbox
            v-for="option in checkboxOptions"
            :key="option.value"
            v-model="selectedDateRange"
            :label="option.label"
            :value="option.value"
            class="custom-checkbox"
            :color="option.color"
            @change="$emit('date-range-changed', option.value)"
          >
          </v-checkbox>
          <template v-if="selectedDateRange === 'custom'">
            <div class="pa-2 ml-8">
              <slot name="custom-checkbox"></slot>
            </div>
          </template>
        </v-card>
      </v-col>
    </v-row>
  </v-card>
</template>

<script>
import { formatDateForHeaders } from '@/utils/data_io'

export default {
  components: {},
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
  },
  data: () => ({
    selectedDateRange: 'today',
    customDateRange: {
      from: null,
      to: null,
    },
    openedPanels: [],
  }),
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

<style>
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
