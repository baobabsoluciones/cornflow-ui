/**
 * The solution of a developer-mode launch: the execution is created with an uploaded solution
 * instead of running the solver. The file picked is read and checked against the solution schema;
 * the last file picked is the one that counts, even while an earlier one is still being read.
 */
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatValidationErrors } from '@cornflow-ui/core/utils/errorFormatting'
import { parseSolutionFile } from './solutionFile'

export function useUploadedSolution() {
  const { t } = useI18n()

  const solution = reactive({
    enabled: false,
    file: null as File | null,
    data: null as any,
    errors: null as string | null,
  })

  async function setSolutionFile(file: File | null) {
    solution.file = file
    solution.data = null
    solution.errors = null
    if (!file) return
    // Another file picked (or none) while this one is read: its result no longer counts
    const isCurrent = () => solution.file === file
    try {
      const parsed = await parseSolutionFile(file, t)
      const errors = await parsed.checkSchema()
      if (!isCurrent()) return
      if (errors?.length) {
        solution.errors = formatValidationErrors(errors)
        return
      }
      solution.data = parsed.data
    } catch (error) {
      if (isCurrent()) solution.errors = error instanceof Error ? error.message : String(error)
    }
  }

  function setSolutionMode(enabled: boolean) {
    solution.enabled = enabled
    if (!enabled) void setSolutionFile(null)
  }

  return { solution, setSolutionFile, setSolutionMode }
}
