import { ExperimentCore } from '@/models/Experiment';
import { Instance } from '@/app/models/Instance';
import { Solution } from '@/app/models/Solution';


export class Experiment extends ExperimentCore{

  constructor(
    instance: Instance, 
    solution: Solution, 
  ) {
    super(instance, solution)
  }
}