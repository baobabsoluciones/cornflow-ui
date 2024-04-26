<template>
  <v-data-table
    fixed-header
    class="pa-2 data-table"
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
      <slot :name="header.value" :item="item">
        <div v-if="!editionMode">
          <template v-if="header.type === 'boolean'">
            <input type="checkbox" :checked="item[header.value]" disabled />
          </template>
          <template v-else>
            {{ item[header.value] }}
          </template>
        </div>
        <div v-else>
          <template v-if="header.type === 'boolean'">
            <input type="checkbox" :checked="item[header.value]" />
          </template>
          <template v-else>
            <v-text-field
              v-model="item[header.value]"
              single-line
              counter
              hide-details
              @input="markAsChanged(item[header.value])"
              :type="header.type"
              :density="options.density"
              :class="{
                'changed-item': changedItems.includes(item[header.value]),
              }"
            ></v-text-field>
          </template>
        </div>
      </slot>
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
    editionMode: {
      type: Boolean,
      default: false,
    },
  },
  data: () => ({
    search: '',
    changedItems: [],
  }),
  methods: {
    markAsChanged(item) {
      if (!this.changedItems.includes(item)) {
        this.changedItems.push(item)
      }
    },
  },
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
  background-color: #f9f9f9 !important;
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

.data-table ::v-deep .v-text-field .v-field--single-line input {
  font-size: 0.875rem;
}

.changed-item {
  background-color: var(--primary-light);
}
</style>
