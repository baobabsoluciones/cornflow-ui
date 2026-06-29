import client from '@/api/Api'
import { Execution } from '@/models/Execution'
import { LoadedExecution } from '@/models/LoadedExecution'
import { useGeneralStore } from '@/stores/general'
import InstanceRepository from './InstanceRepository'
import { formatDateForFilename } from '@/utils/date'
import {
  getApiErrorMessageFromContent,
  getMessageFromResponseContentOrNull,
} from '@/utils/i18nUtils'

function pickDownloadReturnValue(
  experiment: any,
  onlySolution: boolean,
  onlyInstance: boolean,
): any {
  if (onlySolution) return experiment.solution
  if (onlyInstance) return experiment.instance
  return experiment
}

/**
 * Possible `status` values returned by `GET /execution/files/<id>/` when the file
 * is not delivered (HTTP 400). See README — Execution files download.
 */
type BackendFilesUnavailableStatus = 0 | -1 | -2 | -3

type BackendFilesAttempt =
  /** Backend returned a zip and it was saved to disk. */
  | { kind: 'downloaded' }
  /**
   * Backend says no file is available for this execution. Caller should fall back
   * to the local Excel-build flow. Covers `status: 0`, `status: -1`, and HTTP 501.
   */
  | { kind: 'fallback'; reason: string }

/** Error thrown when execution files need regeneration and polling timed out. */
export class ExecutionFilesRegenerationError extends Error {
  constructor(
    public readonly i18nKey: string,
    message?: string,
  ) {
    super(message ?? i18nKey)
    this.name = 'ExecutionFilesRegenerationError'
  }
}

const DEFAULT_REGEN_POLL_INTERVAL_MS = 5_000
const DEFAULT_REGEN_POLL_TIMEOUT_MS = 120_000

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(objectUrl)
}

async function readJsonStatusFromBlob(
  blob: Blob,
): Promise<{ status?: BackendFilesUnavailableStatus; error?: string }> {
  try {
    const text = await blob.text()
    return JSON.parse(text)
  } catch {
    return {}
  }
}

/** Shape returned by `client.getBlob` for the execution-files endpoint. */
type BlobResponse = { status: number; blob: Blob; filename?: string }

/** `true` while the backend reports the file is still being regenerated. */
function isRegenerating(status?: BackendFilesUnavailableStatus): boolean {
  return status === -2 || status === -3
}

/**
 * Polls `fetchOnce` until the file is ready, the backend reports the file is no
 * longer available, or `pollTimeoutMs` elapses. Triggers the download on success.
 * Returns the resolved attempt, or `null` when polling timed out.
 */
async function pollForRegeneratedFiles(
  fetchOnce: () => Promise<BlobResponse>,
  fallbackFilename: string,
  pollIntervalMs: number,
  pollTimeoutMs: number,
): Promise<BackendFilesAttempt | null> {
  const start = Date.now()
  while (Date.now() - start < pollTimeoutMs) {
    await sleep(pollIntervalMs)
    const polled = await fetchOnce()
    if (polled.status === 200) {
      triggerBlobDownload(polled.blob, polled.filename || `${fallbackFilename}.zip`)
      return { kind: 'downloaded' }
    }
    if (polled.status !== 400) {
      // Unexpected status while polling → bail out.
      break
    }
    const { status: pollStatus } = await readJsonStatusFromBlob(polled.blob)
    // Still regenerating → keep polling.
    if (isRegenerating(pollStatus)) continue
    // Backend no longer offers the file → fall back to the local build.
    if (pollStatus === 0 || pollStatus === -1) {
      return { kind: 'fallback', reason: `app-status-${pollStatus}` }
    }
    // Anything else → stop polling and fall through.
    break
  }
  return null
}

export default class ExecutionRepository {
  // Get executions created on the given date range
  async getExecutions(
    name: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<Execution[]> {
    const queryParams: {
      schema: string
      limit: number
      creation_date_lte?: string
      creation_date_gte?: string
    } = {
      schema: name,
      limit: 100,
    }

    if (dateTo) {
      queryParams.creation_date_lte = dateTo
    }

    if (dateFrom) {
      queryParams.creation_date_gte = dateFrom
    }

    if (!dateTo && !dateFrom) {
      queryParams.limit = 15
    }

    const response = await client.get('/execution/', queryParams)

    if (response.status === 200) {
      const executions = response.content
      return executions.map((execution: any) => {
        const logStatusCode = execution.log
          ? execution.log
          : { sol_code: -3, status_code: -3, status_message: '' }
        return new Execution({
          message: execution.message,
          createdAt: execution.created_at,
          config: execution.config,
          state: execution.state,
          solution_state: logStatusCode,
          name: execution.name,
          description: execution.description,
          indicators: execution.indicators,
          dataHash: execution.data_hash,
          schema: execution.schema,
          instanceId: execution.instance_id,
          id: execution.id,
          userId: execution.user_id,
          userName: execution.username,
          userFirstName: execution.first_name,
          userLastName: execution.last_name,
          finishedAt: execution.updated_at,
        })
      })
    } else {
      throw new Error('Error getting executions')
    }
  }

  /**
   * Lightweight poll: returns just the execution metadata (no `/data/`,
   * no instance fetch). Used by `autoLoadExecutions` to check whether a
   * still-running execution has finished without re-pulling MB of payload
   * every 4 seconds for 500k-row instances.
   */
  async getExecutionState(
    id: string,
  ): Promise<{ state: number; id: string } | null> {
    const response = await client.get(`/execution/${id}/`)
    if (response.status === 200) {
      const exec = response.content
      return { state: exec.state, id: exec.id }
    }
    return null
  }

  // Get full execution data by id
  async loadExecution(id: string): Promise<LoadedExecution> {
    const response = await client.get(`/execution/${id}/data/`)

    if (response.status === 200) {
      const execution = response.content
      const instanceRepository = new InstanceRepository()
      const instance = await instanceRepository.getInstance(
        execution.instance_id,
      )
      if (instance) {
        const store = useGeneralStore()
        const { Solution, Experiment } = store.appConfig
        const kpis =
          store.appConfig.parameters?.enableKpisResponseMerge &&
          execution.kpis
            ? execution.kpis
            : null
        const solution = new Solution(
          execution.id,
          execution.data,
          store.schemaConfig.solutionSchema,
          store.schemaConfig.solutionChecksSchema,
          store.getSchemaName,
          execution.checks,
          kpis,
        )
        const experiment = new Experiment(instance, solution)
        return new LoadedExecution({
          experiment,
          executionId: execution.id,
          name: execution.name,
          description: execution.description,
          createdAt: execution.created_at,
          state: execution.state,
          message: execution.message,
          config: execution.config,
        })
      } else {
        throw new Error('Error loading instance')
      }
    } else {
      throw new Error('Error loading execution')
    }
  }

  /**
   * Try to download a backend-generated execution zip via `GET /execution/files/<id>/`.
   * Decision tree follows the contract documented in README — Execution files download.
   * On `status: -2`/`-3`, regeneration is triggered and the endpoint is polled until
   * the file is ready or the timeout elapses.
   */
  private async tryDownloadBackendExecutionFiles(
    id: string,
    fallbackFilename: string,
    pollIntervalMs: number = DEFAULT_REGEN_POLL_INTERVAL_MS,
    pollTimeoutMs: number = DEFAULT_REGEN_POLL_TIMEOUT_MS,
  ): Promise<BackendFilesAttempt> {
    const fetchOnce = () => client.getBlob(`/execution/files/${id}/`)

    const { status, blob, filename } = await fetchOnce()

    if (status === 200) {
      triggerBlobDownload(blob, filename || `${fallbackFilename}.zip`)
      return { kind: 'downloaded' }
    }

    if (status === 501) {
      return { kind: 'fallback', reason: 'execution-files-deactivated' }
    }

    if (status === 400) {
      return this.resolveBackendFilesHttp400(
        id,
        blob,
        fetchOnce,
        fallbackFilename,
        pollIntervalMs,
        pollTimeoutMs,
      )
    }

    const fallbackMsg = await readJsonStatusFromBlob(blob)
    throw new Error(
      fallbackMsg.error ?? `Error downloading execution files (HTTP ${status})`,
    )
  }

  /**
   * Handles the HTTP 400 branch of {@link tryDownloadBackendExecutionFiles}:
   * inspects the app `status`, falls back when no file is available, and triggers
   * regeneration + polling when the file is still being produced.
   */
  private async resolveBackendFilesHttp400(
    id: string,
    blob: Blob,
    fetchOnce: () => Promise<BlobResponse>,
    fallbackFilename: string,
    pollIntervalMs: number,
    pollTimeoutMs: number,
  ): Promise<BackendFilesAttempt> {
    const { status: appStatus } = await readJsonStatusFromBlob(blob)

    if (appStatus === 0 || appStatus === -1) {
      return { kind: 'fallback', reason: `app-status-${appStatus}` }
    }

    if (!isRegenerating(appStatus)) {
      const fallbackMsg = await readJsonStatusFromBlob(blob)
      throw new Error(
        fallbackMsg.error ?? `Error downloading execution files (HTTP 400)`,
      )
    }

    await this.startDataCheckKpisForExecution(id)
    const polled = await pollForRegeneratedFiles(
      fetchOnce,
      fallbackFilename,
      pollIntervalMs,
      pollTimeoutMs,
    )
    if (polled) return polled

    throw new ExecutionFilesRegenerationError(
      'executionTable.filesRegenerationTimeout',
    )
  }

  async getDataToDownload(
    id: string,
    onlySolution: boolean = true,
    onlyInstance: boolean = true,
  ): Promise<any> {
    const store = useGeneralStore()
    const useBackend =
      store.appConfig.parameters?.useBackendExecutionFilesDownload === true

    if (useBackend) {
      const attempt = await this.tryDownloadBackendExecutionFiles(id, id)
      if (attempt.kind === 'downloaded') return null
      // 'fallback' → continue with local Excel build below. A pending
      // regeneration that times out throws ExecutionFilesRegenerationError
      // and propagates to the caller.
    }

    const response = await client.get(`/execution/${id}/data/`)

    if (response.status === 200) {
      const execution = response.content
      const instanceRepository = new InstanceRepository()
      const instance = await instanceRepository.getInstance(
        execution.instance_id,
      )
      if (instance) {
        const { Solution, Experiment } = store.appConfig
        const kpis =
          store.appConfig.parameters?.enableKpisResponseMerge &&
          execution.kpis
            ? execution.kpis
            : null
        const solution = new Solution(
          execution.id,
          execution.data,
          store.schemaConfig.solutionSchema,
          store.schemaConfig.solutionChecksSchema,
          store.getSchemaName,
          execution.checks,
          kpis,
        )

        const experiment = new Experiment(instance, solution)
        const filename =
          execution.name.toLowerCase().replaceAll(' ', '_') +
          '-' +
          formatDateForFilename(execution.created_at)
        await experiment.downloadExcel(filename, onlySolution, onlyInstance)

        return pickDownloadReturnValue(experiment, onlySolution, onlyInstance)
      } else {
        throw new Error('Error loading instance')
      }
    } else {
      throw new Error('Error loading execution')
    }
  }

  async createExecution(execution: any, queryParams: string = '') {
    let instance
    // If instance already exists use it, otherwise create a new one
    if (execution.instance.id) {
      instance = execution.instance
    } else {
      const instanceRepository = new InstanceRepository()
      instance = await instanceRepository.createInstance(execution)
    }

    if (instance) {
      const json = {
        name: execution.name,
        description: execution.description ? execution.description : '',
        config: execution.config,
        schema: useGeneralStore().getSchemaName,
        instance_id: instance.id,
      }

      const response = await client.post(`/execution/${queryParams}`, json, {
        'Content-Type': 'application/json',
      })
      if (response.status === 201) {
        const execution = response.content
        return execution
      } else {
        throw new Error('Error creating execution')
      }
    } else {
      throw new Error('Error creating instance')
    }
  }

  async uploadSolutionData(executionId: string, solutionData: any) {
    const response = await client.put(`/execution/${executionId}/`, {
      data: solutionData,
    })
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        getApiErrorMessageFromContent(
          response.content,
          'Error uploading solution data',
        ),
      )
    }
    return response.content
  }

  async deleteExecution(id: string) {
    const response = await client.remove(`/execution/${id}/`)
    return response.status === 200
  }

  /**
   * Creates a historical KPIs execution instance (POST /external/historical-kpis/).
   * Returns the new execution id.
   */
  async createHistoricalKpisExecution(
    startDate: string,
    endDate: string,
  ): Promise<string> {
    const response = await client.post(
      `/historical-kpis/`,
      { start_date: startDate, end_date: endDate },
      {},
      true,
    )
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        getMessageFromResponseContentOrNull(response.content) ??
          'Error creating historical KPIs execution',
      )
    }
    const content = response.content as Record<string, unknown> | undefined
    const id = content?.id_execution ?? content?.execution_id ?? content?.id
    if (id == null || id === '') {
      throw new Error('No execution id in historical KPIs response')
    }
    return String(id)
  }

  /**
   * Starts the Cornflow data-check KPIs pipeline for an execution.
   */
  async startDataCheckKpisForExecution(executionId: string): Promise<void> {
    const response = await client.post(
      `/data-check-kpis/execution/${executionId}/`,
      {},
      {},
      false,
    )
    if (response.status < 200 || response.status >= 300) {
      throw new Error('Error starting data-check KPIs for execution')
    }
  }
}
