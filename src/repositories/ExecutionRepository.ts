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
    const queryParams: {
      schema: string
      limit: number
      creation_date_lte?: string
      creation_date_gte?: string
    } = {
      schema: name,
      limit: 100,
    }

    if (dateTo) {
      queryParams.creation_date_lte = dateTo
    }

    if (dateFrom) {
      queryParams.creation_date_gte = dateFrom
    }

    if (!dateTo && !dateFrom) {
      queryParams.limit = 15
    }

    const response = await client.get('/execution/', queryParams)

    if (response.status === 200) {
      const executions = response.content
      return executions.map((execution: any) => {
        const logStatusCode = execution.log ? execution.log : {sol_code: -3, status_code: -3, status_message: ''}
        return new Execution(
          execution.message,
          execution.created_at,
          execution.config,
          execution.state,
          logStatusCode,
          execution.name,
          execution.description,
          execution.indicators,
          execution.data_hash,
          execution.schema,
          execution.instance_id,
          execution.id,
          execution.user_id,
          execution.username,
          execution.updated_at,
        )
      })
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
          useGeneralStore().schemaConfig.solutionChecksSchema,
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
          execution.config,
        )
      } else {
        throw new Error('Error loading instance')
      }
    } else {
      throw new Error('Error loading execution')
    }
  }

  async getDataToDownload(
    id: string,
    onlySolution: boolean = true,
    onlyInstance: boolean = true,
  ): Promise<any> {
    try {
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
            useGeneralStore().schemaConfig.solutionChecksSchema,
            useGeneralStore().getSchemaName,
            execution.checks,
          )

          const experiment = new Experiment(instance, solution)
          const filename = execution.name.toLowerCase().replace(/ /g, '_')
          await experiment.downloadExcel(filename, onlySolution, onlyInstance)

          if (onlySolution) {
            return experiment.solution
          }

          if (onlyInstance) {
            return experiment.instance
          }

          return experiment
        } else {
          throw new Error('Error loading instance')
        }
      } else {
        throw new Error('Error loading execution')
      }
    } catch (error) {
      throw error
    }
  }

  async createExecution(execution: any, queryParams: string = '') {
    let instance
    // If instance already exists use it, otherwise create a new one
    if (execution.instance.id) {
      instance = execution.instance
    } else {
      const instanceRepository = new InstanceRepository()
      instance = await instanceRepository.createInstance(execution)
    }

    if (instance) {
      const json = {
        name: execution.name,
        description: execution.description ? execution.description : '',
        config: execution.config,
        schema: useGeneralStore().getSchemaName,
        instance_id: instance.id,
      }

      const response = await client.post(`/execution/${queryParams}`, json, {
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

  async uploadSolutionData(executionId: string, solutionData: any) {
    try {
      const response = await client.put(`/execution/${executionId}/`, {
        data: solutionData
      })
      return response.content
    } catch (error) {
      console.error('Error uploading solution data:', error)
      throw error
    }
  }

  async deleteExecution(id: string) {
    const response = await client.remove(`/execution/${id}/`)
    return response.status === 200
  }

  async refreshExecution(id: string) {}
}
