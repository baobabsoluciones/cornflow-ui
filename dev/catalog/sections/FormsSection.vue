<template>
  <div class="catalog-section">
    <h1 class="catalog-section__title">Form fields</h1>

    <CatalogBlock
      name="CoreTextField"
      api="v-model · type (text | number | date | password | email) · integer · size · multiline · rows · suffix · invalid · disabled · lazy · #append"
    >
      <div class="stack">
        <div class="grid">
          <label class="field">
            <span class="caption">Text</span>
            <CoreTextField v-model="name" placeholder="Name of the execution" />
          </label>
          <label class="field">
            <span class="caption"
              >Number, whole, with a suffix · {{ timeLimit ?? 'null' }}</span
            >
            <CoreTextField
              v-model="timeLimit"
              type="number"
              integer
              suffix="sec"
            />
          </label>
          <label class="field">
            <span class="caption">Date</span>
            <CoreTextField v-model="day" type="date" />
          </label>
          <label class="field">
            <span class="caption">Password, with a button in #append</span>
            <CoreTextField
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
            >
              <template #append>
                <CoreButton
                  variant="icon"
                  size="xs"
                  :icon="
                    showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'
                  "
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  @click="showPassword = !showPassword"
                />
              </template>
            </CoreTextField>
          </label>
          <label class="field">
            <span class="caption">Invalid</span>
            <CoreTextField model-value="" invalid placeholder="Required" />
          </label>
          <label class="field">
            <span class="caption">Disabled</span>
            <CoreTextField model-value="Plan week 43" disabled />
          </label>
        </div>
        <span class="caption">Sizes: small, default, large</span>
        <div class="row">
          <CoreTextField
            v-for="size in sizes"
            :key="size"
            :size="size"
            :placeholder="size"
          />
        </div>
        <label class="field">
          <span class="caption">Several lines</span>
          <CoreTextField
            v-model="description"
            multiline
            :rows="3"
            placeholder="Description"
          />
        </label>
      </div>
    </CatalogBlock>

    <CatalogBlock
      name="CoreSelect"
      api="v-model · options ({ value, label }) · placeholder · clearable · size · invalid · disabled"
    >
      <div class="stack">
        <div class="grid">
          <label class="field">
            <span class="caption">Picked · {{ solver }}</span>
            <CoreSelect v-model="solver" :options="solvers" />
          </label>
          <label class="field">
            <span class="caption">Placeholder · {{ plant ?? 'null' }}</span>
            <CoreSelect
              v-model="plant"
              :options="plants"
              placeholder="Choose a plant…"
            />
          </label>
          <label class="field">
            <span class="caption"
              >Clearable, values of any type · {{ replanning ?? 'null' }}</span
            >
            <CoreSelect
              v-model="replanning"
              :options="yesNo"
              placeholder="Not set"
              clearable
            />
          </label>
          <label class="field">
            <span class="caption">Invalid</span>
            <CoreSelect :options="plants" placeholder="Required" invalid />
          </label>
          <label class="field">
            <span class="caption">Disabled</span>
            <CoreSelect :model-value="solver" :options="solvers" disabled />
          </label>
        </div>
        <span class="caption">Sizes: small, default, large</span>
        <div class="row">
          <CoreSelect
            v-for="size in sizes"
            :key="size"
            :size="size"
            :options="plants"
            :placeholder="size"
          />
        </div>
      </div>
    </CatalogBlock>

    <CatalogBlock name="CoreCheckbox · CoreSwitch" api="v-model · label · disabled · indeterminate (checkbox)">
      <CoreCheckbox v-model="checked" label="Ticked" />
      <CoreCheckbox :model-value="false" indeterminate label="Some selected" />
      <CoreCheckbox :model-value="true" disabled label="Disabled" />
      <CoreSwitch v-model="switched" :label="switched ? 'Yes' : 'No'" />
      <CoreSwitch :model-value="false" disabled label="Not available" />
    </CatalogBlock>

    <CatalogBlock
      name="CoreSegmentedControl"
      api="v-model · options ({ value, label, count, icon, title, disabled }) · variant (solid | soft) · size"
      column
    >
      <CoreSegmentedControl v-model="view" :options="views" />
      <CoreSegmentedControl v-model="view" :options="views" size="small" />
      <CoreSegmentedControl v-model="group" variant="soft" :options="groups" />
    </CatalogBlock>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreCheckbox from '@cornflow-ui/core/components/core/CoreCheckbox.vue'
import CoreSegmentedControl from '@cornflow-ui/core/components/core/CoreSegmentedControl.vue'
import CoreSelect from '@cornflow-ui/core/components/core/CoreSelect.vue'
import CoreSwitch from '@cornflow-ui/core/components/core/CoreSwitch.vue'
import CoreTextField from '@cornflow-ui/core/components/core/CoreTextField.vue'
import CatalogBlock from '../CatalogBlock.vue'

const sizes = ['small', 'default', 'large'] as const

const checked = ref(true)
const switched = ref(true)
const view = ref('summary')
const views = [
  { value: 'summary', label: 'Summary' },
  { value: 'side', label: 'Side by side' },
  { value: 'changes', label: 'Changes', count: 6 },
]
const group = ref('input')
const groups = [
  { value: 'input', label: 'Input data', count: 4 },
  { value: 'output', label: 'Results', count: 2 },
  { value: 'checks', label: 'Checks', count: 4 },
]

const name = ref('Plan week 43')
const timeLimit = ref<string | number | null>(900)
const day = ref<string | number | null>('2026-10-27')
const password = ref<string | number | null>('secret')
const showPassword = ref(false)
const description = ref<string | number | null>('')

const solvers = [
  { value: 'mip.highs', label: 'MIP · HiGHS' },
  { value: 'mip.gurobi', label: 'MIP · Gurobi' },
  { value: 'heuristic.greedy', label: 'Greedy heuristic' },
]
const solver = ref<unknown>('mip.highs')

const plants = [
  { value: 1, label: 'Plant 1' },
  { value: 2, label: 'Plant 2' },
]
const plant = ref<unknown>(null)

const yesNo = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
]
const replanning = ref<unknown>(false)
</script>

<style scoped>
.stack {
  flex: 1 1 100%;
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3);
  min-width: 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: calc(var(--spacing) * 4);
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(var(--spacing) * 3);
}

.field {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
  min-width: 0;
}

.caption {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}
</style>
