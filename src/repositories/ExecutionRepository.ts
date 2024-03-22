import  client from "@/api/Api";
import { Execution } from "@/models/Execution";
import { LoadedExecution } from "@/models/LoadedExecution";
import { useGeneralStore } from "@/stores/general";
import InstanceRepository from "./InstanceRepository";

export default class ExecutionRepository {

  // Get executions created on the given date range
  async getExecutions(name: string, dateFrom: string, dateTo: string): Promise<Execution[]> {
    const queryParams = {
      schema: name,
      creation_date_gte: dateFrom,
      creation_date_lte: dateTo
    };

    const response = await client.get('/execution/', queryParams);
    
    if (response.status === 200) {
      const executions = response.content;
      return executions.map((execution: Execution) => new Execution(execution.message, execution.createdAt, execution.config, execution.state, execution.name, execution.description, execution.indicators, execution.dataHash, execution.schema, execution.instanceId, execution.id, execution.userId))
    } else {
      throw new Error("Error getting executions")
    }
  }

  // Get full execution data by id
  async loadExecution(id: string): Promise<LoadedExecution> {
    const response = await client.get(`/execution/${id}/data/`);

    if (response.status === 200) {
      const execution = response.content;
      const instanceRepository = new InstanceRepository();
      const instance = await instanceRepository.getInstance(execution.instance_id);
      if (instance) {
        const { Solution, Experiment} = useGeneralStore().appConfig;
        const solution = new Solution(execution.id, execution.data, execution.checks, useGeneralStore().schemaConfig.solutionSchema);
        const experiment = new Experiment(instance, solution);
        return new LoadedExecution(experiment, execution.id, execution.name, execution.description, execution.created_at)
      } else {
        throw new Error("Error loading instance")
      }
    } else {
      throw new Error("Error loading execution")
    }
  }

  async createExecution() {
    

  }

  async deleteExecution(id: string) {
    const response = await client.remove(`/execution/${id}/`);
    return response;
  }

  async refreshExecution(id: string) {

  }

}