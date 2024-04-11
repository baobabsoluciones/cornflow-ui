<template>
  <div class="d-flex justify-space-around mt-5">
    <div>
      <h5 class="mb-2">{{ startDateTitle }}</h5>
      <v-date-picker
        hide-header
        color="primary"
        elevation="3"
        v-model="startDate"
        :max="endDate || today"
      ></v-date-picker>
    </div>
    <div>
      <h5 class="mb-2">{{ endDateTitle }}</h5>
      <v-date-picker
        hide-header
        elevation="3"
        v-model="endDate"
        :min="startDate"
        :max="today"
      ></v-date-picker>
    </div>
  </div>
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
