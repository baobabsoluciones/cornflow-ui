import { Instance } from "./Instance";
import { Solution } from "./Solution";

export class LoadedExecution {
  instance: Instance;
  solution: Solution;
  executionId: string;
  name: string;
  description: string;
  createdAt: string;

  constructor(
    instance: Instance, 
    solution: Solution, 
    executionId: string, 
    name: string, 
    description: string, 
    createdAt: string
  ) {
    this.instance = instance;
    this.solution = solution;
    this.executionId = executionId;
    this.name = name;
    this.description = description;
    this.createdAt = createdAt;
  }
}