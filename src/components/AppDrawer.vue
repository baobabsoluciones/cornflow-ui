<template>
  <v-navigation-drawer expand-on-hover rail>
    <v-list nav style="margin-top:30px">
      <v-list-item v-for="item in generalPages" :key="item.pos" :prepend-icon="item.icon" :title="item.title" :to="item.to">
      </v-list-item>
      <v-divider></v-divider>
      <v-list-item v-for="item in executionPages" :key="item.pos" :prepend-icon="item.icon" :title="item.title" :to="item.to">
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'CoreAppDrawer',
  components: {},
  props: {
  },
  data: () => ({
    model: 1,
    mini: true,
    hover: true,
    logo: '',
  }),
  watch: {
  },
  computed: {
    generalPages() {
      return [
        {
          title: 'Project execution',
          icon: 'mdi-chart-timeline-variant',
          to: '/',
          pos: 1,
        },
        {
          title: 'Executions history',
          icon: 'mdi-history',
          to: '/history-execution',
          pos: 2,
          class: 'no-fill-button',
        },
      ];
    },
    executionPages() {
      return [
        {
          title: 'Dashboard',
          icon: 'mdi-view-dashboard',
          to: '/main',
          pos: 1,
        },
        {
          title: 'Project Management',
          icon: 'mdi-application-cog',
          to: '/project-management',
          pos: 2,
          class: 'no-fill-button',
        },
      ];
    },   
},
methods: {
},
});
</script>

<style></style>
