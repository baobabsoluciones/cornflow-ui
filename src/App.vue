<template>
  <v-app>
    <router-view> </router-view>
    <MSnackbar />
  </v-app>
</template>

<script>
import { provide } from 'vue';
import { snackbar, showSnackbar } from '@/services/SnackbarService.ts';

export default {
  components: {
  },
  setup() {
    provide('snackbar', snackbar);
    provide('showSnackbar', showSnackbar);
  },
};
</script>
