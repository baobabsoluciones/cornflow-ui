<template>
  <v-row class="mt-4 justify-space-around">
    <v-col class="v-col-s-12 v-col-4">
      <h5 class="mb-2">{{ startDateTitle }}</h5>
      <v-date-picker
        hide-header
        color="primary"
        elevation="3"
        v-model="startDate"
        :max="endDate || today"
      ></v-date-picker>
    </v-col>
    <v-col class="v-col-s-12 v-col-4">
      <h5 class="mb-2">{{ endDateTitle }}</h5>
      <v-date-picker
        hide-header
        max-width="500px"
        elevation="3"
        v-model="endDate"
        :min="startDate"
        :max="today"
      ></v-date-picker>
    </v-col>
  </v-row>
</template>

<script>
export default {
  props: {
    startDateTitle: {
      type: String,
      default: 'Start date',
    },
    endDateTitle: {
      type: String,
      default: 'End date',
    },
  },
  data() {
    return {
      startDate: null,
      endDate: null,
      today: new Date().toISOString().substr(0, 10),
    }
  },
  watch: {
    startDate(newVal) {
      this.$emit('start-date-change', newVal)
    },
    endDate(newVal) {
      this.$emit('end-date-change', newVal)
    },
  },
}
</script>
