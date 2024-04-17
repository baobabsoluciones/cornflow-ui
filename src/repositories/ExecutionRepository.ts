import client from '@/api/Api'
import { Execution } from '@/models/Execution'
import { LoadedExecution } from '@/models/LoadedExecution'
import { useGeneralStore } from '@/stores/general'
import InstanceRepository from './InstanceRepository'

export default class ExecutionRepository {
  // Get executions created on the given date range
  async getExecutions(
    name: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<Execution[]> {
    const queryParams = {
      schema: name,
      creation_date_gte: dateFrom,
      creation_date_lte: dateTo,
      limit: 100,
    }

    const response = await client.get('/execution/', queryParams)

    if (response.status === 200) {
      const executions = response.content
      return executions.map(
        (execution: any) =>
          new Execution(
            execution.message,
            execution.created_at,
            execution.config,
            execution.state,
            execution.name,
            execution.description,
            execution.indicators,
            execution.data_hash,
            execution.schema,
            execution.instance_id,
            execution.id,
            execution.user_id,
          ),
      )
    } else {
      throw new Error('Error getting executions')
    }
  }

  // Get full execution data by id
  async loadExecution(id: string): Promise<LoadedExecution> {
    const response = await client.get(`/execution/${id}/data/`)

    if (response.status === 200) {
      const execution = response.content
      const instanceRepository = new InstanceRepository()
      const instance = await instanceRepository.getInstance(
        execution.instance_id,
      )
      if (instance) {
        const { Solution, Experiment } = useGeneralStore().appConfig
        const solution = new Solution(
          execution.id,
          execution.data,
          useGeneralStore().schemaConfig.solutionSchema,
          useGeneralStore().getSchemaName,
          execution.checks,
        )
        const experiment = new Experiment(instance, solution)
        return new LoadedExecution(
          experiment,
          execution.id,
          execution.name,
          execution.description,
          execution.created_at,
          execution.state,
          execution.message,
        )
      } else {
        throw new Error('Error loading instance')
      }
    } else {
      throw new Error('Error loading execution')
    }
  }

  async createExecution(execution, createSolution = true) {
    const instanceRepository = new InstanceRepository()
    const instance = await instanceRepository.createInstance(execution)

    if (instance) {
      const json = {
        name: execution.name,
        description: execution.description ? execution.description : '',
        config: {
          timeLimit: parseInt(execution.timeLimit),
          solver: execution.selectedSolver,
        },
        schema: useGeneralStore().getSchemaName,
        instance_id: instance.id,
      }

      const response = await client.post('/execution/', json, {
        'Content-Type': 'application/json',
      })
      if (response.status === 201) {
        const execution = response.content
        return execution
      } else {
        throw new Error('Error creating execution')
      }
    } else {
      throw new Error('Error creating instance')
    }
  }

  async deleteExecution(id: string) {
    const response = await client.remove(`/execution/${id}/`)
    return response
  }

  async refreshExecution(id: string) {}
}
