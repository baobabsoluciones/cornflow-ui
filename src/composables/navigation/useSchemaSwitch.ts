/**
 * useSchemaSwitch — the DAGs a user may work on in a multi-DAG deployment, and switching between
 * them.
 *
 * Picking another DAG switches at once, unless the switch would discard work (executions open in
 * tabs, or an execution being created): then it waits for `confirm()` (or `cancel()`), with
 * `confirming` true meanwhile. After the switch, a view the new DAG doesn't have is left for the
 * new DAG's default view ('/').
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import { readSchemaLabels } from '@cornflow-ui/core/utils/schemaLabels'
import { isRouteAvailableAfterSchemaSwitch } from '@cornflow-ui/core/utils/schemaSwitchNavigation'

export function useSchemaSwitch() {
  const { t, te } = useI18n()
  const store = useGeneralStore()
  const route = useRoute()
  const router = useRouter()

  const pending = ref<string | null>(null)
  const confirming = ref(false)

  const schemas = computed<string[]>(() => store.availableSchemas)
  const current = computed<string>(() => store.getSchemaName)
  const canSwitch = computed(() => Boolean(store.canSwitchSchema))

  /** Text of a DAG: its label (literal text or i18n key), or its name. */
  function schemaLabel(schema: string): string {
    const label = readSchemaLabels()[schema]
    if (!label) return schema
    return te(label) ? t(label) : label
  }

  /** Something the switch would discard: loaded executions, or an execution being created. */
  const discardsWork = () =>
    store.loadedExecutions.length > 0 || route.path.startsWith('/project-execution')

  async function request(schema: string) {
    if (!schema || schema === current.value) return
    pending.value = schema
    if (discardsWork()) confirming.value = true
    else await confirm()
  }

  function cancel() {
    confirming.value = false
    pending.value = null
  }

  async function confirm() {
    const schema = pending.value
    confirming.value = false
    pending.value = null
    if (!schema) return

    if (!(await store.setActiveSchema(schema))) return
    const viewer = {
      roleNames: store.getUser?.roles?.map((role: { name: string }) => role.name) ?? [],
      schema: store.getSchemaName,
    }
    const masterData = store.configurations?.masterData ?? {}
    if (!isRouteAvailableAfterSchemaSwitch(route, masterData, viewer)) {
      // '/' resolves the default view, the new DAG's `defaultView`.
      await router.push('/')
    }
  }

  return { schemas, current, canSwitch, schemaLabel, confirming, request, confirm, cancel }
}
