/**
 * What a run of the suite covered on this deployment: what it tested, what failed and what it did
 * not test, with the reason. A test that does not apply to a deployment (a step it turns off, a dataset it does
 * not have) is skipped with that reason, `test.skip(condition, reason)`, and it shows up here.
 *
 * A test tells which case of the deployment it went through with a `note` annotation, shown next
 * to it. The report also lists the known faults the run came across (annotation `known issue`),
 * which do not fail a test while they wait for their fix.
 *
 * It is printed at the end of the run. The set-up and the clean-up of the run are not part of it,
 * nor are tests that did not run (`--list`, or a set-up that failed): with none run, it prints
 * nothing.
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
    const failed: Line[] = []
    const notTested: Line[] = []
    const knownIssues = new Set<string>()
    for (const test of this.root.allTests()) {
      if (RUN_PROJECTS.includes(test.parent.project()?.name ?? '')) continue
      // Not run at all (only listed, or its set-up failed): it says nothing of the deployment. A
      // test skipped for a reason did run, and has its result.
      if (!test.results.length) continue
      const lastResult = test.results.at(-1)
      // A note made while the test runs is both on the test and on its result: kept once.
      const notes = new Set<string>()
      for (const note of [
        ...test.annotations,
        ...(lastResult?.annotations ?? []),
      ]) {
        if (note.type === 'known issue' && note.description)
          knownIssues.add(note.description)
        if (note.type === 'note' && note.description)
          notes.add(note.description)
      }
      if (test.outcome() === 'skipped') {
        notTested.push({ title: titleOf(test), reason: reasonOf(test) })
      } else {
        // A test that passed on a retry (flaky) did test what it says; one that never passed did not.
        const line = {
          title: titleOf(test),
          reason: [...notes].join('; ') || undefined,
        }
        if (test.outcome() === 'unexpected') failed.push(line)
        else tested.push(line)
      }
    }
    if (!tested.length && !failed.length && !notTested.length) return

    const lines = [
      '',
      `Coverage: ${tested.length} tested, ${failed.length} failed, ${notTested.length} not tested`,
    ]
    const withReason = (line: Line) =>
      `${line.title}${line.reason ? ` (${line.reason})` : ''}`
    for (const line of tested) lines.push(`  tested      ${withReason(line)}`)
    for (const line of failed) lines.push(`  failed      ${withReason(line)}`)
    for (const line of notTested) {
      lines.push(`  not tested  ${line.title}: ${line.reason}`)
    }
    if (knownIssues.size) {
      lines.push(`Known issues: ${knownIssues.size}`)
      for (const issue of knownIssues) lines.push(`  ${issue}`)
    }
    console.log(lines.join('\n'))
  }

  printsToStdio(): boolean {
    return true
  }
}
