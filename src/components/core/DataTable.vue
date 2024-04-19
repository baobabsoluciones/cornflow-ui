<template>
  <v-data-table
    class="pa-2 my-data-table"
    :headers="headers"
    :items="items"
    v-bind="options"
    :hide-default-footer="!showFooter"
    :class="[footerClass, headerClass]"
  >
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
    showHeaders: {
      type: Boolean,
      default: true,
    },
    showFooter: {
      type: Boolean,
      default: true,
    },
  },
  data: () => ({
    search: '',
  }),
  computed: {
    footerClass() {
      return this.showFooter ? '' : 'hide-footer'
    },
    headerClass() {
      return this.showHeaders ? '' : 'hide-header'
    },
  },
}
</script>

<style scoped>
::v-deep .v-data-table__th {
  border-right: 1px solid #0000001e !important; /* Change color as needed */
  background-color: #dde1e644 !important;
}

/* Remove border from the last header cell */
::v-deep .v-data-table__th:last-child {
  border-right: none !important;
}

::v-deep .v-data-table-footer {
  justify-content: space-between !important;
}

.hide-footer ::v-deep .v-data-table-footer {
  display: none;
}

.hide-header ::v-deep .v-data-table__th {
  visibility: hidden;
  height: 0;
  padding: 0;
  border: none;
  line-height: 0;
}

::v-deep table {
  table-layout: fixed !important;
}
</style>
