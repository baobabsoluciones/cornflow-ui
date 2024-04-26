<template>
  <v-dialog
    v-model="dialog"
    :max-width="dialogWidth"
    :persistent="!closeOnOutsideClick"
  >
    <v-card elevation="5" rounded="lg">
      <v-card-title>
        <v-row align="center">
          <v-col>
            <v-icon v-if="icon">{{ icon }}</v-icon>
            <span class="modal_title">{{ title }}</span>
          </v-col>
          <v-col cols="auto">
            <v-icon class="modal_icon_title" @click="$emit('close')"
              >mdi-close</v-icon
            >
          </v-col>
        </v-row>
      </v-card-title>
      <v-card-text>
        <slot name="content"></slot>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn
          v-for="(button, index) in buttons"
          :key="index"
          text
          :class="button.class"
          @click="emitButtonAction(button.action)"
        >
          {{ button.text }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'BaseModal',
  props: {
    value: { type: Boolean, default: false },
    title: {
      type: String,
      default: '',
    },
    icon: {
      type: String,
      default: '',
    },
    buttons: {
      type: Array,
      default: () => [],
    },
    size: {
      type: String,
      default: 'md',
    },
    closeOnOutsideClick: {
      type: Boolean,
      default: true,
    },
  },
  computed: {
    dialogWidth() {
      switch (this.size) {
        case 'xs':
          return '300px'
        case 'lg':
          return '800px'
        default:
          return '500px'
      }
    },
  },
  data() {
    return {
      dialog: false,
    }
  },
  methods: {
    emitButtonAction(action) {
      this.$emit(action)
    },
  },
  watch: {
    value: {
      immediate: true,
      handler(val) {
        this.dialog = val
      },
    },
  },
}
</script>
<style>
.modal_icon_title {
  margin-right: 10px;
  font-size: 0.9rem !important;
}

.modal_title {
  font-size: 1rem;
}
</style>
