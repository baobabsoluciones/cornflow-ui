<template>
  <v-app>
    <router-view> </router-view>
    <Snackbar />
  </v-app>
</template>

<script>
import { provide } from 'vue';
import Snackbar from '@/components/core/Snackbar.vue';
import { snackbar, showSnackbar } from '@/services/SnackbarService.ts';

export default {
  components: {
    Snackbar,
  },
  setup() {
    provide('snackbar', snackbar);
    provide('showSnackbar', showSnackbar);
  },
};
</script>
