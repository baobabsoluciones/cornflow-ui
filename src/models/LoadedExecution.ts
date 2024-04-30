import { ExperimentCore } from './Experiment'

export class LoadedExecution {
  experiment: ExperimentCore
  executionId: string
  name: string
  description: string
  createdAt: string
  state: number
  messageState: string
  config: any

  constructor(
    experiment: ExperimentCore,
    executionId: string,
    name: string,
    description: string,
    createdAt: string,
    state: number,
    message: string,
    config: any,
  ) {
    this.experiment = experiment
    this.executionId = executionId
    this.name = name
    this.description = description
    this.createdAt = createdAt
    this.state = state
    this.messageState = message
    this.config = config
  }

  hasSolution() {
    return this.experiment.hasSolution()
  }
}
