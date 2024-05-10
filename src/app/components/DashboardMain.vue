<!--
    This is a general structure for dashboard components. The layout is defined in the config.ts file under the dashboardLayout property.
    This layout can be customized as per the user's requirements. Each object in the dashboardLayout array represents a component on the dashboard.
    Each object should have the following properties:
    - component: The imported Vue component.
    - cols: The number of columns that the component should span.
    - bindings: Any props that should be passed to the component.
    - style: Any additional CSS styles for the component.
    The DashboardMain component renders the components based on the layout defined in the store.
    Notice that this file can be overridden to customize the layout further.
  -->
<template>
  <v-row class="mt-2">
    <v-col
      v-for="(chart, index) in dashboardComponents"
      :key="index"
      :cols="chart.cols"
      class="mb-3"
    >
      <component
        :is="chart.component"
        v-bind="chart.bindings"
        :style="chart.style"
      />
    </v-col>
  </v-row>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useGeneralStore } from '@/stores/general'

export default defineComponent({
  name: 'DashboardMain',
  components: {},
  props: {
    execution: {
      type: Object,
      required: true,
    },
  },
  data: () => ({
    store: useGeneralStore(),
  }),
  watch: {},
  computed: {
    dashboardComponents() {
      return this.store.appDashboardLayout
    },
  },
  methods: {},
})
</script>

<style></style>
