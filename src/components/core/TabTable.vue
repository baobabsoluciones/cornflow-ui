<template>
  <v-card style="max-height: 75vh" elevation="5">
    <v-row>
      <v-col
        :cols="direction === 'vertical' ? 3 : 12"
        style="margin-top: -6px !important"
      >
        <slot name="tabs">
          <v-tabs
            class="px-5 pb-2"
            :class="
              direction === 'vertical'
                ? 'px-5 pb-2 tabs-border-vertical'
                : 'px-5 pb-2 tabs-border-horizontal'
            "
            show-arrows
            :direction="direction"
            v-model="selectedTab"
            :style="direction === 'vertical' ? 'max-height: 75vh' : ''"
            nextIcon="mdi-chevron-down"
            prevIcon="mdi-chevron-up"
          >
            <v-tab
              v-for="(tab, index) in tabsData"
              :key="index"
              :value="tab.value"
            >
              {{ tab.text }}
            </v-tab>
          </v-tabs>
        </slot>
      </v-col>
      <v-col :cols="direction === 'vertical' ? 9 : 12">
        <slot name="actions"> </slot>
        <v-row>
          <slot name="table" :tableData="selectedTab">
            {{ selectedTab }}
          </slot>
        </v-row>
        <v-row>
          <slot name="customButton"></slot>
        </v-row>
      </v-col>
    </v-row>
  </v-card>
</template>

<script>
import { ref, computed, watch } from 'vue'

export default {
  props: {
    tabsData: {
      type: Array,
      default: () => [],
    },
    selectedTable: {
      type: String,
      default: null,
    },
    direction: {
      type: String,
      default: 'vertical',
    },
  },
  setup(props, { emit }) {
    const selectedTab = ref(props.selectedTable)

    watch(
      () => props.tabsData,
      (newVal) => {
        if (
          newVal.length > 0 &&
          selectedTab.value === null &&
          props.selectedTable === null
        ) {
          selectedTab.value = newVal[0]?.value
        }
      },
      { immediate: true },
    )

    watch(selectedTab, (newVal) => {
      emit('update:selectedTab', newVal)
    })

    return {
      selectedTab,
    }
  },
}
</script>

<style scoped>
.tabs-border {
  border-right: 2px solid rgba(0, 0, 0, 0.1);
}

.tabs-border-vertical {
  border-right: 2px solid rgba(0, 0, 0, 0.1);
}

.tabs-border-horizontal {
  border-bottom: 2px solid rgba(0, 0, 0, 0.1);
}

.v-row {
  margin: 0px !important;
}

::v-deep .v-tab--selected {
  color: var(--primary) !important;
}
</style>
