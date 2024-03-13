import  client from "@/api/Api";
import { Execution } from "@/models/Execution";
import { LoadedExecution } from "@/models/LoadedExecution";
import { useGeneralStore } from "@/stores/general";

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

  async loadExecution(id: string): Promise<LoadedExecution> {
    const response = await client.get(`/execution/${id}/data/`);

    if (response.status === 200) {
      const execution = response.content;
      const instanceResponse = await client.get(`/instance/${execution.instance_id}/`);
      if (instanceResponse.status === 200) {
        const instanceContent = instanceResponse.content;
        const { Instance, Solution} = useGeneralStore().appConfig;
        const instance = new Instance(instanceContent.id, instanceContent.data, instanceContent.checks, useGeneralStore().schemaConfig.instanceSchema);
        const solution = new Solution(execution.id, execution.data, execution.checks, useGeneralStore().schemaConfig.solutionSchema);
        return new LoadedExecution(instance, solution, execution.id, execution.name, execution.description, execution.created_at)
      } else {
        throw new Error("Error loading instance")
      }
    } else {
      throw new Error("Error loading execution")
    }
  }

}