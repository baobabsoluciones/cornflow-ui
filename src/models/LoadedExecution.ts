import { ExperimentCore } from './Experiment'

export class LoadedExecution {
  experiment: ExperimentCore
  executionId: string
  name: string
  description: string
  createdAt: string
  state: number
  messageState: string

  constructor(
    experiment: ExperimentCore,
    executionId: string,
    name: string,
    description: string,
    createdAt: string,
    state: number,
    message: string,
  ) {
    this.experiment = experiment
    this.executionId = executionId
    this.name = name
    this.description = description
    this.createdAt = createdAt
    this.state = state
    this.messageState = message
  }
}
