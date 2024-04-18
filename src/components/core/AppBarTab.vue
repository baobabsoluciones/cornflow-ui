<template>
  <v-bottom-navigation
    style="position: fixed !important"
    bg-color="#EAEAEA"
    height="40"
    elevation="0"
  >
    <v-tabs density="compact">
      <v-tab
        class="my-tab"
        max-height="40"
        density="compact"
        rounded="xs"
        slim
        v-for="(tab, index) in tabs"
        :key="index"
        :class="tab.selected ? 'selected-tab' : ''"
      >
        <v-icon v-if="tab.loading" class="mr-2 loading-icon" color="primary"
          >mdi-loading</v-icon
        >
        <v-icon v-else class="mr-2" color="primary">{{ tab.icon }}</v-icon>
        {{ tab.text
        }}<v-icon
          style="font-size: 0.7rem !important"
          @click="closeTab(index)"
          class="ml-3"
          >mdi-close</v-icon
        >
      </v-tab>
    </v-tabs>
    <v-spacer></v-spacer>
    <v-btn
      class="create-tab-btn"
      variant="outlined"
      size="x-small"
      rounded="lg"
      @click="$emit('create')"
    >
      <v-row no-gutters class="align-center">
        <v-col cols="auto">
          <v-icon style="font-size: 0.85rem" class="mr-1">mdi-plus</v-icon>
        </v-col>
        <v-col cols="auto">
          {{ createTitle }}
        </v-col>
      </v-row>
    </v-btn>
  </v-bottom-navigation>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'AppBarTab',
  props: {
    tabs: {
      type: Array,
      default: () => [],
    },
    createTitle: {
      type: String,
      default: '',
    },
  },
  setup(props, { emit }) {
    const closeTab = (index) => {
      emit('close', index)
    }

    return { closeTab }
  },
}
</script>

<style scoped>
.selected-tab {
  background-color: var(--background-variant) !important;
}

.my-tab ::v-deep .v-btn__content {
  font-size: 0.9em !important;
  text-transform: none !important;
  color: var(--title);
  padding: 5px !important;
  letter-spacing: normal !important;
}

.loading-icon {
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

::v-deep .v-tab.v-tab.v-btn {
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-bottom: none !important;
  border-radius: 5px 5px 0 0;
}

::v-deep .v-tab--selected {
  background-color: var(--background) !important;
}

::v-deep .v-tab--selected .v-tab__slider {
  opacity: 0 !important;
}

::v-deep.v-bottom-navigation .v-bottom-navigation__content > .v-btn {
  height: 60% !important;
  border-color: rgba(0, 0, 0, 0.1);
  margin-top: 10px !important;
  margin-right: 5px !important;
}

::v-deep .v-btn--active > .v-btn__overlay {
  opacity: 0 !important;
}
</style>
