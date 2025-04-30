export class Execution {
  message: string
  createdAt: string
  finishedAt: string | null
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
  userName: string | null

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
    finishedAt: string | null = null,
    userName: string | null = null,
  ) {
    this.message = message
    this.createdAt = createdAt
    this.finishedAt = finishedAt
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
    this.userName = userName
  }
}
