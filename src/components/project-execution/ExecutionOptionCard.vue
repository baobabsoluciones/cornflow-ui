<template>
  <v-row>
    <v-col cols="12">
      <v-card flat tile variant="outlined" :style="cardStyle">
        <v-card-text
          class="d-flex align-center title-execution"
          style="padding: 0px !important"
        >
          <v-icon left class="ml-3">{{ icon }}</v-icon>
          <h4 class="flex-grow-1 ml-2">{{ title }}</h4>
          <v-checkbox
            class="mr-2"
            color="primary"
            hide-details
            v-model="isChecked"
          ></v-checkbox>
        </v-card-text>
        <v-card-text class="pa-4">
          <span style="color: var(--subtitle)">{{ description }}</span>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script>
export default {
  name: 'ExecutionOptionCard',
  props: {
    icon: {
      type: String,
      default: 'mdi-star',
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    option: {
      type: String,
      required: true,
    },
    selected: {
      type: String,
      default: null,
    },
  },
  data() {
    return {}
  },
  computed: {
    isChecked: {
      get() {
        return this.option === this.selected
      },
      set(val) {
        if (val) {
          this.$emit('checkbox-change', { value: val, option: this.option })
        }
      },
    },
    cardStyle() {
      return {
        borderRadius: '10px !important',
        borderColor: this.isChecked
          ? 'rgb(var(--v-theme-primary)) !important'
          : '#e4e7ec !important',
      }
    },
  },
}
</script>

<style scoped>
.title-execution {
  background-color: #dfe0e1 !important;
  color: var(--title) !important;
}
</style>
