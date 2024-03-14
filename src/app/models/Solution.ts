import { SolutionCore } from '@/models/Solution';

export class Solution extends SolutionCore{

  constructor(
    id: string,
    data: object,
    checks: object,
    schema: string,
  ) {
    super(id, data, checks, schema);
  }
}