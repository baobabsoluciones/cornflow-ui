<template>
    <v-snackbar v-model="snackbar.show" :color="snackbar.color">
        <span>{{ snackbar.message }}</span>
        <template v-slot:actions>
            <v-icon @click="snackbar.show = false">mdi-close</v-icon>
        </template>
    </v-snackbar>
</template>

<script>
import { inject } from 'vue';

export default {
    setup() {
        const snackbar = inject('snackbar');
        return { snackbar };
    },
};
</script>
