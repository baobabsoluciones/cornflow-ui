/**
 * The UAT file: what each app gives the suite to test its deployment with. It is the only thing
 * the suite cannot find out by itself, because it depends on each app's model.
 *
 * `tests/e2e/uat.json` of the app (or the file `E2E_UAT_FILE` names):
 *
 *   {
 *     "mode": "shared",
 *     "schemas": {
 *       "<dag>": {
 *         "config": { "solver": "...", "timeLimit": 60 },
 *         "datasets": {
 *           "valid": "data/valid.json",
 *           "withErrors": "data/with_errors.json",
 *           "withWarnings": "data/with_warnings.json"
 *         },
 *         "solution": "data/solution.json",
 *         "infeasible": { "dataset": "valid", "config": { "solver": "..." } },
 *         "failingSolver": { "dataset": "valid", "config": { "solver": "..." } }
 *       }
 *     }
 *   }
 *
 * - `mode`: `shared` on an environment others use (a pre): the suite only touches what it creates
 *   and deletes it at the end. `disposable` on one that is thrown away: it also tests what changes
 *   or deletes data, and creates a user per role.
 * - `config`: the execution config every case of the schema runs with.
 * - `datasets`: instance data (JSON) that the checks find nothing in, that has errors, and that has
 *   warnings only. Paths are relative to the UAT file. A kind left out is not tested, and the
 *   coverage report says so.
 * - `solution` (optional): a solution of the `valid` dataset, as the DAG returns it (the `data` of
 *   the execution). The tests that need an execution already solved save it to one in a moment
 *   instead of solving (see harness/executions.ts); without it, they solve for real.
 * - `infeasible` and `failingSolver` (optional): a dataset and the config to add to `config` for an
 *   execution that ends with no solution, and for one whose solver fails.
 *
 * The credentials are never in the file: `E2E_USER` and `E2E_PASSWORD` (an admin in `disposable`).
 */
import fs from 'node:fs'
import path from 'node:path'

export type Mode = 'shared' | 'disposable'

export const DATASET_KINDS = ['valid', 'withErrors', 'withWarnings'] as const
export type DatasetKind = (typeof DATASET_KINDS)[number]

/** A dataset of the schema run with more config: an execution that has to end a given way. */
export interface ExecutionCase {
  dataset: DatasetKind
  config: Record<string, unknown>
}

export interface SchemaData {
  config: Record<string, unknown>
  /** Absolute paths of the datasets the app gave. */
  datasets: Partial<Record<DatasetKind, string>>
  /** Absolute path of a solution of the `valid` dataset, if the app gave one. */
  solution?: string
  infeasible?: ExecutionCase
  failingSolver?: ExecutionCase
}

export interface Uat {
  /** Absolute path of the UAT file. */
  file: string
  mode: Mode
  schemas: Record<string, SchemaData>
}

const MODES: Mode[] = ['shared', 'disposable']
const CASES = ['infeasible', 'failingSolver'] as const

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Reads and checks the UAT file. Throws one error listing every problem found, so that a run
 * that cannot test the deployment says why before it starts.
 */
export function loadUat(file: string): Uat {
  if (!fs.existsSync(file)) {
    throw new Error(
      `[cornflow-e2e] No UAT file at ${file}. Each app gives the suite its test data in ` +
        'tests/e2e/uat.json (or the file E2E_UAT_FILE names); see tests/e2e/README.md.',
    )
  }
  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch (error) {
    throw new Error(
      `[cornflow-e2e] ${file} is not valid JSON: ${(error as Error).message}`,
    )
  }

  const problems: string[] = []
  const dir = path.dirname(file)
  const uat: Uat = { file, mode: 'shared', schemas: {} }

  if (!isObject(raw)) {
    problems.push('it has to be an object with "mode" and "schemas"')
  } else {
    if (MODES.includes(raw.mode as Mode)) uat.mode = raw.mode as Mode
    else
      problems.push(
        `"mode" has to be one of ${MODES.map((m) => `"${m}"`).join(', ')}`,
      )

    if (!isObject(raw.schemas) || !Object.keys(raw.schemas).length) {
      problems.push('"schemas" has to name at least one schema (DAG)')
    } else {
      for (const [schema, value] of Object.entries(raw.schemas)) {
        const at = `schemas.${schema}`
        if (!isObject(value)) {
          problems.push(`${at} has to be an object`)
          continue
        }
        const data: SchemaData = { config: {}, datasets: {} }
        if (isObject(value.config)) data.config = value.config
        else
          problems.push(
            `${at}.config has to be the execution config (an object)`,
          )

        if (!isObject(value.datasets)) {
          problems.push(`${at}.datasets has to be an object of dataset paths`)
        } else {
          for (const [kind, relative] of Object.entries(value.datasets)) {
            if (!DATASET_KINDS.includes(kind as DatasetKind)) {
              problems.push(
                `${at}.datasets.${kind} is not one of ${DATASET_KINDS.join(', ')}`,
              )
              continue
            }
            if (typeof relative !== 'string') {
              problems.push(`${at}.datasets.${kind} has to be a path`)
              continue
            }
            const absolute = path.resolve(dir, relative)
            const problem = datasetProblem(absolute)
            if (problem)
              problems.push(`${at}.datasets.${kind} (${relative}) ${problem}`)
            else data.datasets[kind as DatasetKind] = absolute
          }
        }

        if (value.solution !== undefined) {
          if (typeof value.solution !== 'string') {
            problems.push(`${at}.solution has to be a path`)
          } else {
            const absolute = path.resolve(dir, value.solution)
            const problem = datasetProblem(absolute)
            if (problem)
              problems.push(`${at}.solution (${value.solution}) ${problem}`)
            else if (!isObject(value.datasets) || !('valid' in value.datasets))
              problems.push(
                `${at}.solution is a solution of the valid dataset, which is not given`,
              )
            else data.solution = absolute
          }
        }

        for (const name of CASES) {
          const item = value[name]
          if (item === undefined) continue
          if (
            !isObject(item) ||
            !DATASET_KINDS.includes(item.dataset as DatasetKind) ||
            !isObject(item.config)
          ) {
            problems.push(
              `${at}.${name} has to be { "dataset": one of ${DATASET_KINDS.join(', ')}, "config": {…} }`,
            )
          } else if (
            !((item.dataset as DatasetKind) in (value.datasets as object))
          ) {
            problems.push(
              `${at}.${name} uses the dataset "${item.dataset}", which is not given`,
            )
          } else {
            data[name] = {
              dataset: item.dataset as DatasetKind,
              config: item.config,
            }
          }
        }
        uat.schemas[schema] = data
      }
    }
  }

  if (problems.length) {
    throw new Error(
      `[cornflow-e2e] The UAT file ${file} is not right:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    )
  }
  return uat
}

/** Why a dataset file cannot be used, or nothing when it can. */
function datasetProblem(file: string): string | null {
  if (!fs.existsSync(file)) return 'does not exist'
  try {
    return isObject(JSON.parse(fs.readFileSync(file, 'utf-8')))
      ? null
      : 'is not a JSON object'
  } catch {
    return 'is not valid JSON'
  }
}

/** The solution the app gave for the valid dataset of the schema, or null. */
export function readSolution(
  uat: Uat,
  schema: string,
): Record<string, unknown> | null {
  const file = uat.schemas[schema]?.solution
  return file ? JSON.parse(fs.readFileSync(file, 'utf-8')) : null
}

/** The data of a dataset of the schema, or null when the app did not give that kind. */
export function readDataset(
  uat: Uat,
  schema: string,
  kind: DatasetKind,
): Record<string, unknown> | null {
  const file = uat.schemas[schema]?.datasets[kind]
  return file ? JSON.parse(fs.readFileSync(file, 'utf-8')) : null
}
