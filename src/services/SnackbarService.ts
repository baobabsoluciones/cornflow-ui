import { reactive } from 'vue';

export const snackbar = reactive({
  show: false,
  message: '',
  color: 'success',
});

export function showSnackbar(message, color = 'success') {
  snackbar.show = true;
  snackbar.message = message;
  snackbar.color = color;
}