import { ExperimentCore } from "./Experiment";

export class LoadedExecution {
  experiment: ExperimentCore;
  executionId: string;
  name: string;
  description: string;
  createdAt: string;

  constructor(
    experiment: ExperimentCore,
    executionId: string, 
    name: string, 
    description: string, 
    createdAt: string
  ) {
    this.experiment = experiment;
    this.executionId = executionId;
    this.name = name;
    this.description = description;
    this.createdAt = createdAt;
  }
}