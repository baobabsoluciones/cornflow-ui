export class Execution {
  message: string
  createdAt: string
  config: object
  state: number
  solution_state: number
  name: string
  description: string
  indicators: string
  dataHash: string
  schema: string
  instanceId: string
  id: string
  userId: number

  constructor(
    message: string,
    createdAt: string,
    config: object,
    state: number,
    solution_state: number,
    name: string,
    description: string,
    indicators: string,
    dataHash: string,
    schema: string,
    instanceId: string,
    id: string,
    userId: number,
  ) {
    this.message = message
    this.createdAt = createdAt
    this.config = config
    this.state = state
    this.solution_state = solution_state
    this.name = name
    this.description = description
    this.indicators = indicators
    this.dataHash = dataHash
    this.schema = schema
    this.instanceId = instanceId
    this.id = id
    this.userId = userId
  }
}
