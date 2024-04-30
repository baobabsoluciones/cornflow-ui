import { InstanceCore } from './Instance'
import { SolutionCore } from './Solution'

export class ExperimentCore {
  instance: InstanceCore
  solution: SolutionCore

  constructor(instance: InstanceCore, solution: SolutionCore) {
    this.instance = instance
    this.solution = solution
  }

  hasSolution() {
    return this.solution.hasSolution()
  }
}
