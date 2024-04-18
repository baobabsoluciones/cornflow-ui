<template>
  <v-data-table class="pa-2" :headers="headers" :items="items" v-bind="options">
    <template
      v-for="header in headers"
      v-slot:[`item.${header.value}`]="{ item }"
    >
      <slot :name="header.value" :item="item"> {{ item[header.value] }}</slot>
    </template>
  </v-data-table>
</template>

<script>
export default {
  props: {
    headers: {
      type: Array,
      required: true,
    },
    items: {
      type: Array,
      required: true,
    },
    options: {
      type: Object,
      default: () => ({}),
    },
  },
  data: () => ({
    search: '',
  }),
}
</script>

<style scoped>
::v-deep .v-data-table__th {
  border-right: 1px solid #0000001e !important; /* Change color as needed */
}

/* Remove border from the last header cell */
::v-deep .v-data-table__th:last-child {
  border-right: none !important;
}

::v-deep .v-data-table-footer {
  justify-content: space-between !important;
}
</style>
