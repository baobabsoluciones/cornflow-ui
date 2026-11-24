/**
 * Runs once after the tests, even when some failed: deletes whatever carries this run's id
 * (executions, instances and the users the set-up made), so the backend is left as it was.
 */
import { test as teardown } from '@playwright/test'
import { CornflowApi } from '../harness/cornflowApi'
import { backendUrl, credentials, readDeployment, runId } from '../harness/run'

teardown('clean up the run', async () => {
  const { username, password } = credentials()
  // The set-up may have stopped before describing the deployment: Cornflow at the root then.
  const hasExternalApp = readDeploymentOrNull()?.hasExternalApp ?? false
  const api = new CornflowApi({
    backendUrl: backendUrl(),
    cornflowPath: hasExternalApp ? '/cornflow' : '',
    runId: runId(),
  })
  await api.login(username, password)
  const removed = await api.sweepRun()
  console.log(
    `[cornflow-e2e] Cleaned up run ${api.runId}: ${removed.executions} executions, ` +
      `${removed.instances} instances, ${removed.users} users.`,
  )
})

function readDeploymentOrNull() {
  try {
    return readDeployment()
  } catch {
    return null
  }
}
