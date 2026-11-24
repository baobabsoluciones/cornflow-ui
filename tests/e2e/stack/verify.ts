/**
 * Checks that the stack does what the suite expects of it: every case of e2e_planning, run
 * through the Cornflow API, ends as it should. Run it with the stack up, after changing its images
 * or the app, to tell a broken stack from a broken interface:
 *
 *   npm run test:e2e:stack
 *
 * It signs in with the stack's admin (the one in docker-compose.yml, unless E2E_STACK_USER and
 * E2E_STACK_PASSWORD say otherwise) and deletes what it created when it ends.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type Checks,
  CornflowApi,
  ExecutionState,
} from '../suite/harness/cornflowApi'

const SCHEMA = 'e2e_planning'
const DATA_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'dags',
  SCHEMA,
  'data',
)

type Dataset = 'valid' | 'with_errors' | 'with_warnings'

interface Case {
  name: string
  dataset: Dataset
  solver: 'default' | 'infeasible' | 'failing'
  /** Checks of the instance that must find something; any other must find nothing. */
  instanceChecks: string[]
  state: number
  /** Rows of the plan in the solution: none when the execution has no solution. */
  planRows: number
  /**
   * A fault of Cornflow that can make the case end otherwise. It is reported, but it does not make
   * the stack fail: the stack is as the clients have it, fault included.
   */
  knownIssue?: string
}

const CASES: Case[] = [
  {
    name: 'valid',
    dataset: 'valid',
    solver: 'default',
    instanceChecks: [],
    state: ExecutionState.Solved,
    planRows: 9,
  },
  {
    name: 'with errors',
    dataset: 'with_errors',
    solver: 'default',
    instanceChecks: ['unknown_products'],
    state: ExecutionState.Solved,
    planRows: 0,
  },
  {
    name: 'with warnings',
    dataset: 'with_warnings',
    solver: 'default',
    instanceChecks: ['zero_demand'],
    state: ExecutionState.Solved,
    planRows: 9,
  },
  {
    name: 'infeasible',
    dataset: 'valid',
    solver: 'infeasible',
    instanceChecks: [],
    state: ExecutionState.Solved,
    planRows: 0,
  },
  {
    name: 'failing solver',
    dataset: 'valid',
    solver: 'failing',
    instanceChecks: [],
    state: ExecutionState.Error,
    planRows: 0,
    knownIssue:
      'Cornflow 1.3.9 saves the error (-1) and, right after, the log of the task in a second ' +
      'PUT /dag/<id>/ without state, which the server takes as solved (1). Whether it ends in ' +
      '-1 or 1 depends on the log being written in time.',
  },
]

function readDataset(name: Dataset): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(DATA_DIR, `${name}.json`), 'utf-8'))
}

/** Names of the checks that found something. */
function foundChecks(checks: Checks): string[] {
  return Object.entries(checks)
    .filter(([, rows]) => Array.isArray(rows) && rows.length > 0)
    .map(([name]) => name)
    .sort()
}

/** What went differently from what the case expects; empty when it ended as it should. */
async function run(api: CornflowApi, item: Case): Promise<string[]> {
  const instanceId = await api.createInstance({
    schema: SCHEMA,
    data: readDataset(item.dataset),
    label: item.name,
  })
  const config = { solver: item.solver, timeLimit: 60, seconds: 0 }

  const checks = foundChecks(
    await api.checkInstance(instanceId, SCHEMA, config),
  )
  const executionId = await api.createExecution({
    instanceId,
    schema: SCHEMA,
    config,
    label: item.name,
  })
  const state = await api.waitForExecution(executionId)
  const { data } = await api.executionData(executionId)
  const planRows = Array.isArray(data?.plan) ? data.plan.length : 0

  const differences: string[] = []
  const expectedChecks = [...item.instanceChecks].sort()
  if (checks.join() !== expectedChecks.join()) {
    differences.push(
      `instance checks [${checks}] instead of [${expectedChecks}]`,
    )
  }
  if (state !== item.state)
    differences.push(`state ${state} instead of ${item.state}`)
  if (planRows !== item.planRows) {
    differences.push(`${planRows} plan rows instead of ${item.planRows}`)
  }
  return differences
}

async function main(): Promise<void> {
  const api = new CornflowApi({
    backendUrl: process.env.E2E_STACK_URL ?? 'http://localhost:5091',
  })
  await api.login(
    process.env.E2E_STACK_USER ?? 'cornflow_admin',
    process.env.E2E_STACK_PASSWORD ?? 'Tz8!qw-Lmb#Rv4x',
  )

  let failed = 0
  let known = 0
  try {
    // One case after another: the airflow of the stack (Airflow 2) turns down some executions
    // asked for at the same time ("Airflow is not accessible").
    const results: PromiseSettledResult<string[]>[] = []
    for (const item of CASES) {
      results.push(
        await run(api, item).then(
          (value) => ({ status: 'fulfilled' as const, value }),
          (reason: unknown) => ({ status: 'rejected' as const, reason }),
        ),
      )
    }
    results.forEach((result, index) => {
      const item = CASES[index]
      const differences =
        result.status === 'fulfilled' ? result.value : [String(result.reason)]
      if (!differences.length) {
        console.log(`ok    ${item.name}`)
      } else if (result.status === 'fulfilled' && item.knownIssue) {
        known++
        console.log(`known ${item.name}: ${differences.join('; ')}`)
        console.log(`      ${item.knownIssue}`)
      } else {
        failed++
        console.log(`FAIL  ${item.name}: ${differences.join('; ')}`)
      }
    })
  } finally {
    await api.cleanup()
  }

  const asTheyShould = CASES.length - failed - known
  console.log(
    `\n${asTheyShould} of ${CASES.length} cases end as they should` +
      (known ? `, ${known} as a known issue of Cornflow makes them` : '') +
      (failed ? `, ${failed} failed` : ''),
  )
  process.exitCode = failed ? 1 : 0
}

await main()
