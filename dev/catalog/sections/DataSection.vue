<template>
  <div class="catalog-section">
    <h1 class="catalog-section__title">Data</h1>

    <CatalogBlock
      name="CoreDescriptionList"
      api="title · items ({ label, value, muted }) · minColumnWidth"
      column
    >
      <CoreDescriptionList title="Execution data" :items="data" />
      <CoreDescriptionList title="Execution parameters" :items="parameters" />
    </CatalogBlock>

    <CatalogBlock
      name="CoreTimeline"
      api="title · steps ({ key, label, time, description, status, tone, icon, spin, progress })"
      note="Status: done, current, failed, skipped or pending."
      column
    >
      <CoreTimeline
        v-for="(steps, index) in timelines"
        :key="index"
        :title="index === 0 ? 'Progress' : ''"
        :steps="steps"
      />
    </CatalogBlock>
  </div>
</template>

<script setup lang="ts">
import CoreDescriptionList from '@cornflow-ui/core/components/core/CoreDescriptionList.vue'
import CoreTimeline from '@cornflow-ui/core/components/core/CoreTimeline.vue'
import type { TimelineStep } from '@cornflow-ui/core/components/core/CoreTimeline.vue'
import CatalogBlock from '../CatalogBlock.vue'

const data = [
  { label: 'User', value: 'Ana García' },
  { label: 'Created', value: '21 Oct 2026 · 10:30' },
  { label: 'Finished', value: '—', muted: true },
  { label: 'Duration', value: '12 min 04 s · in progress' },
  { label: 'Solver', value: 'mip_solver' },
  { label: 'Time limit', value: '900 sec' },
]
const parameters = [
  { label: 'Start date', value: '26 Oct 2026' },
  { label: 'Horizon', value: '7 days' },
  { label: 'Plant', value: 'North plant' },
  { label: 'Mode', value: null },
]

const timelines: TimelineStep[][] = [
  [
    {
      key: 'queued',
      label: 'Queued',
      time: '10:30',
      description: 'Created',
      status: 'done',
    },
    {
      key: 'run',
      label: 'Running',
      description: '12 min 04 s of 15 min 00 s',
      status: 'current',
      icon: 'mdi-loading',
      spin: true,
      progress: 80,
      progressLabel: 'Time used of the solver´s limit',
    },
    {
      key: 'end',
      label: 'Finished',
      description: 'Pending',
      status: 'pending',
    },
  ],
  [
    {
      key: 'queued',
      label: 'Queued',
      time: '10:30',
      description: 'Created',
      status: 'done',
    },
    {
      key: 'run',
      label: 'Execution',
      description: 'Took 11 min 20 s',
      status: 'done',
    },
    {
      key: 'end',
      label: 'Success',
      time: '10:41',
      description: 'The execution has been solved correctly',
      status: 'current',
      tone: 'success',
      icon: 'mdi-check-circle',
    },
  ],
  [
    {
      key: 'queued',
      label: 'Queued',
      time: '10:30',
      description: 'Created',
      status: 'done',
    },
    {
      key: 'run',
      label: 'Execution',
      description: 'Could not start',
      status: 'failed',
      icon: 'mdi-alert-circle',
    },
    {
      key: 'end',
      label: 'Error',
      time: '10:30',
      description: 'The execution could not start',
      status: 'current',
      tone: 'danger',
      icon: 'mdi-alert-circle',
    },
  ],
  [
    {
      key: 'queued',
      label: 'Queued',
      time: '10:30',
      description: 'Created',
      status: 'done',
    },
    {
      key: 'run',
      label: 'Execution',
      description: 'Not run by the user',
      status: 'skipped',
    },
    {
      key: 'end',
      label: 'Not run',
      time: '10:30',
      description: 'The user did not run it',
      status: 'current',
      tone: 'warning',
      icon: 'mdi-minus-circle',
    },
  ],
]
</script>
