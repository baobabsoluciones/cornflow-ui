import { ExperimentCore } from './Experiment'

type UIPreferences = {
  inputData: { selectedTable: null | string; filters: null | object }
  outputData: { selectedTable: null | string; filters: null | object }
  dashboard: any
}

export class LoadedExecution {
  experiment: ExperimentCore
  executionId: string
  name: string
  description: string
  createdAt: string
  /** Last update of the execution (when it finished, once it has). */
  finishedAt: string | null
  /** Who launched it: user name, and full name where the user has one. */
  userName: string | null
  userFullName: string | null
  state: number
  messageState: string
  /** The solver's log status (`status_code`: the solution state), when the execution has one. */
  solutionState: { status_code?: number | null } | null
  config: any
  private readonly uiPreferences: UIPreferences

  constructor(params: {
    experiment: ExperimentCore
    executionId: string
    name: string
    description: string
    createdAt: string
    finishedAt?: string | null
    userName?: string | null
    userFullName?: string | null
    state: number
    message: string
    solutionState?: { status_code?: number | null } | null
    config: any
  }) {
    this.experiment = params.experiment
    this.executionId = params.executionId
    this.name = params.name
    this.description = params.description
    this.createdAt = params.createdAt
    this.finishedAt = params.finishedAt ?? null
    this.userName = params.userName ?? null
    this.userFullName = params.userFullName ?? null
    this.state = params.state
    this.messageState = params.message
    this.solutionState = params.solutionState ?? null
    this.config = params.config
    this.uiPreferences = {
      inputData: { selectedTable: null, filters: {} },
      outputData: { selectedTable: null, filters: {} },
      dashboard: null,
    }
  }

  setSelectedTablePreference(table: string, type: 'instance' | 'solution') {
    const preferenceType = type === 'instance' ? 'inputData' : 'outputData'
    this.uiPreferences[preferenceType].selectedTable = table
  }

  setFiltersPreference(filters: any, type: 'instance' | 'solution') {
    const preferenceType = type === 'instance' ? 'inputData' : 'outputData'
    this.uiPreferences[preferenceType].filters = filters
  }

  setDashboardPreference(dashboard: any) {
    this.uiPreferences.dashboard = dashboard
  }

  getSelectedTablePreference(type: 'instance' | 'solution') {
    const preferenceType = type === 'instance' ? 'inputData' : 'outputData'
    return this.uiPreferences[preferenceType].selectedTable
  }

  getFiltersPreference(type: 'instance' | 'solution') {
    const preferenceType = type === 'instance' ? 'inputData' : 'outputData'
    return this.uiPreferences[preferenceType].filters
  }

  getDashboardPreferences() {
    return this.uiPreferences.dashboard
  }

  hasSolution() {
    return this.experiment.hasSolution()
  }

  hasInstance() {
    return this.experiment.hasInstance()
  }
}
