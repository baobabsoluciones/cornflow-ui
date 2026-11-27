/**
 * Executions a test needs already solved before it opens the interface: to load one, look at its
 * data, edit it or find it in the history. Creating them through the interface and waiting for the
 * solver is what the create-execution tests do; here they are made through the API in a moment.
 *
 * With the UAT file's `solution` of the schema, the execution is created from the `valid` dataset
 * without running and the solution is put in it:
 *
 * - `saved`: saved as the DAG saves it when it ends (`PUT /dag/<id>/`), with the log of a solution
 *   found, so the execution is solved (state 1, solution "Optimal"), exactly as after a real run.
 *   The execution is the test user's; saving it takes an admin, which `E2E_USER` is in
 *   `disposable` mode, so that user saves it.
 * - `uploaded`: when `E2E_USER` is not an admin, uploaded by the test user as a user does from
 *   the interface instead of solving (`PUT /execution/<id>/`). Cornflow keeps the state "not run"
 *   (-4) and the solution.
 *
 * Without a `solution`, it is solved for real (`solved`), which takes as long as the solver.
 *
 * Another dataset than `valid` can be asked for, and its data checks run first, for real, so the
 * instance keeps what they found (`withChecks`). The UAT file's `solution` is the valid dataset's:
 * put in an execution of another dataset, it is still shown as its solution, which is all a test
 * that looks at the instance needs.
 */
import { test } from '@playwright/test'
import { CornflowApiError, type CornflowApi } from './cornflowApi'
import { credentials } from './run'
import { allowFor, executionTimeout } from './timing'
import { readDataset, readSolution, type DatasetKind, type Uat } from './uat'

/** How long the data checks of an instance may take: a run of the DAG's checks in Airflow. */
const CHECKS_TIMEOUT = 180_000

const DATASET_NAMES: Record<DatasetKind, string> = {
  valid: 'valid',
  withErrors: 'with errors',
  withWarnings: 'with warnings',
}

/** How the execution got its solution. */
export type SolvedHow = 'saved' | 'uploaded' | 'solved'

export interface SolvedExecution {
  id: string
  instanceId: string
  /** Its name: `api.name(label)`. */
  name: string
  /** Its state once it has the solution (`ExecutionState`). */
  state: number
  how: SolvedHow
}

/**
 * An execution of `schema` with a solution, named `api.name(label)`, made from the `valid`
 * dataset (or `dataset`). Skips the test when the UAT file does not have that dataset for the
 * schema. Deleted with the rest of what `api` created when the test ends.
 */
export async function solvedExecution(
  api: CornflowApi,
  uat: Uat,
  schema: string,
  label: string,
  {
    dataset = 'valid',
    withChecks = false,
  }: { dataset?: DatasetKind; withChecks?: boolean } = {},
): Promise<SolvedExecution> {
  const data = readDataset(uat, schema, dataset)
  test.skip(
    !data,
    `the UAT file has no ${DATASET_NAMES[dataset]} dataset for ${schema}`,
  )
  const config = uat.schemas[schema].config
  const instanceId = await api.createInstance({
    schema,
    data: data!,
    label,
  })
  if (withChecks) {
    allowFor(CHECKS_TIMEOUT)
    await api.checkInstance(instanceId, schema, config, {
      timeoutMs: CHECKS_TIMEOUT,
    })
  }
  const solution = readSolution(uat, schema)

  if (!solution) {
    const timeout = executionTimeout(config)
    allowFor(timeout)
    const id = await api.createExecution({ instanceId, schema, config, label })
    const state = await api.waitForExecution(id, { timeoutMs: timeout })
    note(
      `the execution was solved for real: the UAT file has no solution for ${schema}`,
    )
    return { id, instanceId, name: api.name(label), state, how: 'solved' }
  }

  const id = await api.createExecution({
    instanceId,
    schema,
    config,
    label,
    run: false,
  })
  let how: SolvedHow = 'saved'
  try {
    const { username, password, totpSecret } = credentials()
    const saver = await api.signedInAs(username, password, totpSecret)
    await saver.saveResults(id, solution)
  } catch (error) {
    if (!(error instanceof CornflowApiError && error.status === 403))
      throw error
    await api.uploadSolution(id, solution)
    how = 'uploaded'
    note(
      'the solution was uploaded as a user does, so the execution is "not run": the user ' +
        'cannot save it as the DAG does (it takes an admin)',
    )
  }
  return {
    id,
    instanceId,
    name: api.name(label),
    state: await api.executionState(id),
    how,
  }
}

/** Notes once on the running test how its execution was made. */
function note(description: string): void {
  const annotations = test.info().annotations
  if (
    !annotations.some((a) => a.type === 'note' && a.description === description)
  )
    annotations.push({ type: 'note', description })
}
