import getUserFullName from "@cornflow-ui/core/utils/user"

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
  userFullName: string | null

  constructor(opts: {
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
    userName?: string | null
    userFirstName?: string | null
    userLastName?: string | null
    finishedAt?: string | null
  }) {
    const userName = opts.userName ?? null
    const userFirstName = opts.userFirstName ?? null
    const userLastName = opts.userLastName ?? null
    this.message = opts.message
    this.createdAt = opts.createdAt
    this.finishedAt = opts.finishedAt ?? null
    this.config = opts.config
    this.state = opts.state
    this.solution_state = opts.solution_state
    this.name = opts.name
    this.description = opts.description
    this.indicators = opts.indicators
    this.dataHash = opts.dataHash
    this.schema = opts.schema
    this.instanceId = opts.instanceId
    this.id = opts.id
    this.userId = opts.userId
    this.userName = userName
    this.userFullName = getUserFullName(userFirstName, userLastName) || this.userName
  }
}