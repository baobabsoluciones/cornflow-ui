/**
 * What a run of the suite covered on this deployment: what it tested and what it did not, with
 * the reason. A test that does not apply to a deployment (a step it turns off, a dataset it does
 * not have) is skipped with that reason, `test.skip(condition, reason)`, and it shows up here.
 *
 * It is printed at the end of the run. The set-up and the clean-up of the run are not part of it.
 */
import type {
  FullResult,
  Reporter,
  Suite,
  TestCase,
} from '@playwright/test/reporter'

interface Line {
  title: string
  reason?: string
}

/** The projects that prepare and clean up the run, rather than test the deployment. */
const RUN_PROJECTS = ['setup', 'teardown']

/** The test's path below its project and file: `describe › test`. */
function titleOf(test: TestCase): string {
  return test.titlePath().slice(3).join(' › ')
}

/** Why a skipped test was skipped, as `test.skip` or `test.fixme` noted it. */
function reasonOf(test: TestCase): string {
  const note = test.annotations.find(
    (annotation) => annotation.type === 'skip' || annotation.type === 'fixme',
  )
  return note?.description || 'no reason given'
}

export default class CoverageReporter implements Reporter {
  private root: Suite | null = null

  onBegin(_config: unknown, suite: Suite): void {
    this.root = suite
  }

  onEnd(_result: FullResult): void {
    if (!this.root) return
    const tested: Line[] = []
    const notTested: Line[] = []
    for (const test of this.root.allTests()) {
      if (RUN_PROJECTS.includes(test.parent.project()?.name ?? '')) continue
      if (test.outcome() === 'skipped') {
        notTested.push({ title: titleOf(test), reason: reasonOf(test) })
      } else if (test.results.length) {
        tested.push({ title: titleOf(test) })
      }
    }
    if (!tested.length && !notTested.length) return

    const lines = [
      '',
      `Coverage: ${tested.length} tested, ${notTested.length} not tested`,
    ]
    for (const line of tested) lines.push(`  tested      ${line.title}`)
    for (const line of notTested) {
      lines.push(`  not tested  ${line.title}: ${line.reason}`)
    }
    console.log(lines.join('\n'))
  }

  printsToStdio(): boolean {
    return true
  }
}
