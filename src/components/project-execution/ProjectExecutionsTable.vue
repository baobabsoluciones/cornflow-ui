<template>
  <MFilterSearch :filters="filters"></MFilterSearch>
  <DataTable :headers="headerExecutions" :items="executionsByDate">
    <template v-slot:createdAt="{ item }">
      {{ new Date(item.createdAt).toISOString().split('T')[0] }}
    </template>
    <template v-slot:solver="{ item }">
      {{ item.config.solver }}
    </template>
    <template v-slot:solution="{ item }">
      <v-icon>
        {{
          item.message === 'The execution has been solved correctly.'
            ? 'mdi-check'
            : 'mdi-close'
        }}
      </v-icon>
    </template>
    <template v-slot:state="{ item }">
      <v-chip
        :color="
          item.state === 0 ? 'purple' : item.state === 1 ? 'green' : 'red'
        "
      >
        {{
          item.state === 0 ? 'Loading' : item.state === 1 ? 'Ready' : 'Error'
        }}
      </v-chip>
    </template>
    <template v-slot:excel="{ item }">
      <v-icon @click="console.log('descargar')">mdi-microsoft-excel</v-icon>
    </template>
    <template v-slot:actions="{ item }">
      <span>
        <v-icon>mdi-pencil</v-icon>
        <v-icon>mdi-delete</v-icon>
      </span>
    </template>
  </DataTable>
</template>

<script>
import DataTable from '@/components/core/DataTable.vue'
import { inject } from 'vue'

export default {
  components: {
    DataTable,
  },
  props: {
    executionsByDate: {
      type: Array,
      required: true,
    },
  },
  data() {
    return {
      showSnackbar: null,
      headerExecutions: [
        { title: this.$t('executionTable.date'), value: 'createdAt' },
        { title: this.$t('executionTable.name'), value: 'name' },
        { title: this.$t('executionTable.description'), value: 'description' },
        { title: this.$t('executionTable.excel'), value: 'excel' },
        { title: this.$t('executionTable.status'), value: 'state' },
        { title: this.$t('executionTable.solver'), value: 'solver' },
        { title: this.$t('executionTable.solution'), value: 'solution' },
        { title: this.$t('executionTable.actions'), value: 'actions' },
      ],
      filters: {
        age: {
          min: 18,
          max: 65,
          type: 'range',
        },
        salary: {
          min: 800,
          max: 2000,
          type: 'range',
        },
        status: {
          type: 'checkbox',
          options: [
            { checked: true, label: 'Single', value: 'single' },
            { checked: true, label: 'Married', value: 'married' },
          ],
        },
        skills: {
          type: 'checkbox',
          options: [
            { checked: false, label: 'Python', value: 'python' },
            { checked: false, label: 'C', value: 'c' },
            { checked: false, label: 'Rust', value: 'rust' },
            { checked: false, label: 'Go', value: 'go' },
            { checked: false, label: 'C++', value: 'c++' },
            { checked: false, label: 'SQL', value: 'sql' },
            { checked: false, label: 'HTML', value: 'html' },
            { checked: false, label: 'PHP', value: 'php' },
            { checked: false, label: 'Vue', value: 'vue' },
            { checked: false, label: 'React', value: 'react' },
            { checked: false, label: 'Javascript', value: 'javascript' },
            { checked: false, label: 'Typescript', value: 'typescript' },
            { checked: false, label: 'Java', value: 'java' },
            { checked: false, label: 'C#', value: 'c#' },
            { checked: false, label: 'Ruby', value: 'ruby' },
            { checked: false, label: 'Perl', value: 'perl' },
            { checked: false, label: 'Cobol', value: 'cobol' },
            { checked: false, label: 'Fortran', value: 'fortran' },
            { checked: false, label: 'Pascal', value: 'pascal' },
            { checked: false, label: 'Basic', value: 'basic' },
          ],
        },
        availability: {
          type: 'daterange',
          min: new Date('2024-03-01'),
          max: new Date('2024-12-31'),
        },
      },
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
  },
  methods: {},
}
</script>
<style></style>
